/**
 * In-memory alert transition/cooldown tracking.
 * Module-level state persists across requests within the same Node process.
 */

import type { AppSettings } from '@/lib/settings-store'
import { parseRecipients, sendEmail } from '@/lib/notifier'

const alertedOffline = new Set<string>()
const activeThresholdAlerts = new Set<string>()
const rateLimitAlertAt = new Map<string, number>()

/** Returns true if this is a new offline event (first time seeing this server down). */
export function trackOffline(serverId: string): boolean {
  if (alertedOffline.has(serverId)) return false
  alertedOffline.add(serverId)
  return true
}

/** Call when a server comes back online so it can alert again on next failure. */
export function trackOnline(serverId: string): void {
  alertedOffline.delete(serverId)
}

/**
 * Transition tracker for threshold-style alerts.
 * Returns true only when a condition transitions from inactive -> active.
 */
export function trackThresholdAlert(key: string, active: boolean): boolean {
  if (active) {
    if (activeThresholdAlerts.has(key)) return false
    activeThresholdAlerts.add(key)
    return true
  }
  activeThresholdAlerts.delete(key)
  return false
}

/**
 * Cooldown tracker for bursty events like rate-limit hits.
 * Returns true when enough time has passed since the last alert for this key.
 */
export function canSendRateLimitAlert(key: string, cooldownMs = 60_000): boolean {
  const now = Date.now()
  const last = rateLimitAlertAt.get(key) ?? 0
  if (now - last < cooldownMs) return false
  rateLimitAlertAt.set(key, now)
  return true
}

async function postJson(url: string, payload: unknown): Promise<void> {
  try {
    await fetch(url, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify(payload),
    })
  } catch {
    // Non-fatal: channel failures must not break app flows
  }
}

async function sendNotificationEmail(settings: AppSettings, subject: string, text: string): Promise<void> {
  if (!settings.alertEmailEnabled) return
  const recipients = parseRecipients(settings.alertRecipients)
  if (!recipients.length) return
  try {
    await sendEmail(
      {
        host: settings.smtpHost,
        port: settings.smtpPort,
        user: settings.smtpUser,
        pass: settings.smtpPassword,
        from: settings.smtpFrom,
      },
      recipients,
      subject,
      text
    )
  } catch {
    // Non-fatal: email failures must not break app flows
  }
}

export async function sendServerDownAlerts(settings: AppSettings, serverName: string): Promise<void> {
  const nowUtc = new Date().toUTCString()
  const jobs: Promise<void>[] = []

  if (settings.slackWebhookUrl) {
    jobs.push(postJson(settings.slackWebhookUrl, {
      text: 'VynAI Alert - Server offline',
      blocks: [
        {
          type: 'section',
          text: {
            type: 'mrkdwn',
            text: `*VynAI Alert*\n*Server offline:* \`${serverName}\`\nVynAI cannot reach this Ollama server.`,
          },
        },
        {
          type: 'context',
          elements: [{ type: 'mrkdwn', text: `Detected at ${nowUtc}` }],
        },
      ],
    }))
  }

  if (settings.teamsWebhookUrl) {
    jobs.push(postJson(settings.teamsWebhookUrl, {
      '@type': 'MessageCard',
      '@context': 'https://schema.org/extensions',
      summary: 'VynAI Alert - Server offline',
      text: `VynAI Alert\nServer offline: ${serverName}`,
    }))
  }

  if (settings.customWebhookUrl) {
    jobs.push(postJson(settings.customWebhookUrl, {
      alert_type: 'server_down',
      title: 'VynAI Alert',
      description: `Server offline: ${serverName}`,
      severity: 'critical',
      timestamp: new Date().toISOString(),
      source: 'vynai/overview',
    }))
  }

  jobs.push(sendNotificationEmail(settings, '[VynAI] Server Offline Alert', `Server offline: ${serverName}\nDetected at ${nowUtc}`))

  await Promise.allSettled(jobs)
}

export async function sendRateLimitAlerts(settings: AppSettings, detail: string): Promise<void> {
  const nowUtc = new Date().toUTCString()
  const jobs: Promise<void>[] = []

  if (settings.slackWebhookUrl) {
    jobs.push(postJson(settings.slackWebhookUrl, {
      text: 'VynAI Alert - Rate limit hit',
      blocks: [
        {
          type: 'section',
          text: {
            type: 'mrkdwn',
            text: `*VynAI Alert*\n*Rate limit hit:* ${detail}`,
          },
        },
        {
          type: 'context',
          elements: [{ type: 'mrkdwn', text: `Detected at ${nowUtc}` }],
        },
      ],
    }))
  }

  if (settings.teamsWebhookUrl) {
    jobs.push(postJson(settings.teamsWebhookUrl, {
      '@type': 'MessageCard',
      '@context': 'https://schema.org/extensions',
      summary: 'VynAI Alert - Rate limit hit',
      text: `VynAI Alert\nRate limit hit: ${detail}`,
    }))
  }

  if (settings.customWebhookUrl) {
    jobs.push(postJson(settings.customWebhookUrl, {
      alert_type: 'rate_limit',
      title: 'VynAI Alert',
      description: `Rate limit hit: ${detail}`,
      severity: 'warning',
      timestamp: new Date().toISOString(),
      source: 'vynai/gateway',
    }))
  }

  jobs.push(sendNotificationEmail(settings, '[VynAI] Rate Limit Alert', `Rate limit hit: ${detail}\nDetected at ${nowUtc}`))

  await Promise.allSettled(jobs)
}

export async function sendThresholdAlerts(
  settings: AppSettings,
  serverName: string,
  metric: string,
  value: string,
  threshold: string
): Promise<void> {
  const nowUtc = new Date().toUTCString()
  const jobs: Promise<void>[] = []

  if (settings.slackWebhookUrl) {
    jobs.push(postJson(settings.slackWebhookUrl, {
      text: 'VynAI Alert - Threshold exceeded',
      blocks: [
        {
          type: 'section',
          text: {
            type: 'mrkdwn',
            text: `*VynAI Alert*\n*Server:* \`${serverName}\`\n*Metric:* ${metric}\n*Value:* ${value}\n*Threshold:* ${threshold}`,
          },
        },
        {
          type: 'context',
          elements: [{ type: 'mrkdwn', text: `Detected at ${nowUtc}` }],
        },
      ],
    }))
  }

  if (settings.teamsWebhookUrl) {
    jobs.push(postJson(settings.teamsWebhookUrl, {
      '@type': 'MessageCard',
      '@context': 'https://schema.org/extensions',
      summary: 'VynAI Alert - Threshold exceeded',
      text: `VynAI Alert\nServer: ${serverName}\nMetric: ${metric}\nValue: ${value}\nThreshold: ${threshold}`,
    }))
  }

  if (settings.customWebhookUrl) {
    jobs.push(postJson(settings.customWebhookUrl, {
      alert_type: 'threshold',
      title: 'VynAI Alert',
      description: `Server ${serverName}: ${metric}=${value} (threshold ${threshold})`,
      severity: 'warning',
      timestamp: new Date().toISOString(),
      source: 'vynai/overview',
    }))
  }

  jobs.push(sendNotificationEmail(
    settings,
    '[VynAI] Threshold Alert',
    `Server: ${serverName}\nMetric: ${metric}\nValue: ${value}\nThreshold: ${threshold}\nDetected at ${nowUtc}`
  ))

  await Promise.allSettled(jobs)
}

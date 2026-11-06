import fs from 'fs'
import path from 'path'
import type { AppSettings } from '@/lib/settings-store'
import { writeJsonAtomically } from '@/lib/json-storage'
import { enqueueNotifications } from '@/lib/notification-outbox'

const STATE_FILE = path.join(process.cwd(), 'data', 'alert-state.json')

interface AlertState {
  offline: string[]
  thresholds: string[]
  rateLimitAt: Record<string, number>
}

function readState(): AlertState {
  try {
    const state = JSON.parse(fs.readFileSync(STATE_FILE, 'utf8'))
    return {
      offline: Array.isArray(state.offline) ? state.offline : [],
      thresholds: Array.isArray(state.thresholds) ? state.thresholds : [],
      rateLimitAt: state.rateLimitAt && typeof state.rateLimitAt === 'object' ? state.rateLimitAt : {},
    }
  } catch {
    return { offline: [], thresholds: [], rateLimitAt: {} }
  }
}

function writeState(state: AlertState): void {
  writeJsonAtomically(STATE_FILE, state)
}

/** Returns true if this is a new offline event (first time seeing this server down). */
export function trackOffline(serverId: string): boolean {
  const state = readState()
  if (state.offline.includes(serverId)) return false
  state.offline.push(serverId)
  writeState(state)
  return true
}

/** Call when a server comes back online so it can alert again on next failure. */
export function trackOnline(serverId: string): void {
  const state = readState()
  const offline = state.offline.filter(id => id !== serverId)
  if (offline.length === state.offline.length) return
  state.offline = offline
  writeState(state)
}

/**
 * Transition tracker for threshold-style alerts.
 * Returns true only when a condition transitions from inactive -> active.
 */
export function trackThresholdAlert(key: string, active: boolean): boolean {
  const state = readState()
  const isActive = state.thresholds.includes(key)
  if (active) {
    if (isActive) return false
    state.thresholds.push(key)
    writeState(state)
    return true
  }
  if (!isActive) return false
  state.thresholds = state.thresholds.filter(value => value !== key)
  writeState(state)
  return false
}

/**
 * Cooldown tracker for bursty events like rate-limit hits.
 * Returns true when enough time has passed since the last alert for this key.
 */
export function canSendRateLimitAlert(key: string, cooldownMs = 60_000): boolean {
  const now = Date.now()
  const state = readState()
  const last = state.rateLimitAt[key] ?? 0
  if (now - last < cooldownMs) return false
  state.rateLimitAt[key] = now
  writeState(state)
  return true
}

export function clearRateLimitAlert(key: string): void {
  const state = readState()
  if (!(key in state.rateLimitAt)) return
  delete state.rateLimitAt[key]
  writeState(state)
}

export async function sendServerDownAlerts(settings: AppSettings, serverName: string): Promise<void> {
  const nowUtc = new Date().toUTCString()
  await enqueueNotifications(settings, {
    webhooks: {
      slackWebhookUrl: {
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
      },
      teamsWebhookUrl: {
      '@type': 'MessageCard',
      '@context': 'https://schema.org/extensions',
      summary: 'VynAI Alert - Server offline',
      text: `VynAI Alert\nServer offline: ${serverName}`,
      },
      customWebhookUrl: {
      alert_type: 'server_down',
      title: 'VynAI Alert',
      description: `Server offline: ${serverName}`,
      severity: 'critical',
      timestamp: new Date().toISOString(),
      source: 'vynai/overview',
      },
    },
    email: { subject: '[VynAI] Server Offline Alert', text: `Server offline: ${serverName}\nDetected at ${nowUtc}` },
  })
}

export async function sendRateLimitAlerts(settings: AppSettings, detail: string): Promise<void> {
  const nowUtc = new Date().toUTCString()
  await enqueueNotifications(settings, {
    webhooks: {
      slackWebhookUrl: {
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
      },
      teamsWebhookUrl: {
      '@type': 'MessageCard',
      '@context': 'https://schema.org/extensions',
      summary: 'VynAI Alert - Rate limit hit',
      text: `VynAI Alert\nRate limit hit: ${detail}`,
      },
      customWebhookUrl: {
      alert_type: 'rate_limit',
      title: 'VynAI Alert',
      description: `Rate limit hit: ${detail}`,
      severity: 'warning',
      timestamp: new Date().toISOString(),
      source: 'vynai/gateway',
      },
    },
    email: { subject: '[VynAI] Rate Limit Alert', text: `Rate limit hit: ${detail}\nDetected at ${nowUtc}` },
  })
}

export async function sendThresholdAlerts(
  settings: AppSettings,
  serverName: string,
  metric: string,
  value: string,
  threshold: string
): Promise<void> {
  const nowUtc = new Date().toUTCString()
  await enqueueNotifications(settings, {
    webhooks: {
      slackWebhookUrl: {
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
      },
      teamsWebhookUrl: {
      '@type': 'MessageCard',
      '@context': 'https://schema.org/extensions',
      summary: 'VynAI Alert - Threshold exceeded',
      text: `VynAI Alert\nServer: ${serverName}\nMetric: ${metric}\nValue: ${value}\nThreshold: ${threshold}`,
      },
      customWebhookUrl: {
      alert_type: 'threshold',
      title: 'VynAI Alert',
      description: `Server ${serverName}: ${metric}=${value} (threshold ${threshold})`,
      severity: 'warning',
      timestamp: new Date().toISOString(),
      source: 'vynai/overview',
      },
    },
    email: {
      subject: '[VynAI] Threshold Alert',
      text: `Server: ${serverName}\nMetric: ${metric}\nValue: ${value}\nThreshold: ${threshold}\nDetected at ${nowUtc}`,
    },
  })
}

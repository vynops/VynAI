/**
 * In-memory tracker for server-down Slack alerts.
 * Ensures we only notify on the online→offline transition, not every poll.
 * Module-level state persists across requests within the same Node process.
 */

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

/** Send a Slack notification via webhook. */
export async function sendSlackAlert(webhookUrl: string, serverName: string): Promise<void> {
  const payload = {
    text: `🔴 *VynAI Alert* — Server offline`,
    blocks: [
      {
        type: 'section',
        text: {
          type: 'mrkdwn',
          text: `🔴 *VynAI Alert*\n*Server offline:* \`${serverName}\`\nVynAI cannot reach this Ollama server.`,
        },
      },
      {
        type: 'context',
        elements: [{ type: 'mrkdwn', text: `Detected at ${new Date().toUTCString()}` }],
      },
    ],
  }

  try {
    await fetch(webhookUrl, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify(payload),
    })
  } catch {
    // Non-fatal — don't let Slack errors break the overview response
  }
}

/** Send a Slack notification for rate-limit events. */
export async function sendRateLimitSlackAlert(webhookUrl: string, detail: string): Promise<void> {
  const payload = {
    text: '*VynAI Alert* - Rate limit hit',
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
        elements: [{ type: 'mrkdwn', text: `Detected at ${new Date().toUTCString()}` }],
      },
    ],
  }

  try {
    await fetch(webhookUrl, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify(payload),
    })
  } catch {
    // Non-fatal — don't break API flow when Slack is unavailable
  }
}

/** Send a Slack notification for threshold breaches. */
export async function sendThresholdSlackAlert(
  webhookUrl: string,
  serverName: string,
  metric: string,
  value: string,
  threshold: string
): Promise<void> {
  const payload = {
    text: '*VynAI Alert* - Threshold exceeded',
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
        elements: [{ type: 'mrkdwn', text: `Detected at ${new Date().toUTCString()}` }],
      },
    ],
  }

  try {
    await fetch(webhookUrl, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify(payload),
    })
  } catch {
    // Non-fatal — don't break API flow when Slack is unavailable
  }
}

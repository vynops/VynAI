/**
 * In-memory tracker for server-down Slack alerts.
 * Ensures we only notify on the online→offline transition, not every poll.
 * Module-level state persists across requests within the same Node process.
 */

const alertedOffline = new Set<string>()

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

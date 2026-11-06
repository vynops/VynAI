import fs from 'fs'
import path from 'path'
import { randomUUID } from 'crypto'
import type { AppSettings } from '@/lib/settings-store'
import { parseRecipients, sendEmail } from '@/lib/notifier'
import { writeJsonAtomically } from '@/lib/json-storage'

const OUTBOX_FILE = path.join(process.cwd(), 'data', 'notification-outbox.json')
const MAX_DELIVERIES = 500
const MAX_ATTEMPTS_PER_CYCLE = 10
const MAX_BACKOFF_MS = 60 * 60 * 1000
let processing = false

type WebhookChannel = 'slackWebhookUrl' | 'teamsWebhookUrl' | 'customWebhookUrl'
type DeliveryChannel = WebhookChannel | 'email'

interface Delivery {
  id: string
  channel: DeliveryChannel
  payload?: unknown
  subject?: string
  text?: string
  recipients?: string[]
  createdAt: string
  attempts: number
  nextAttemptAt: string
  lastError?: string
  deliveredAt?: string
}

export interface NotificationDeliverySummary {
  pending: number
  retrying: number
  oldestPendingAt: string | null
  lastError: string | null
}

function readQueue(): Delivery[] {
  try {
    const parsed = JSON.parse(fs.readFileSync(OUTBOX_FILE, 'utf8'))
    return Array.isArray(parsed.deliveries) ? parsed.deliveries : []
  } catch {
    return []
  }
}

function writeQueue(deliveries: Delivery[]): void {
  const pending = deliveries.filter(delivery => !delivery.deliveredAt)
  const completed = deliveries.filter(delivery => delivery.deliveredAt).slice(-MAX_DELIVERIES)
  writeJsonAtomically(OUTBOX_FILE, { deliveries: [...completed, ...pending] })
}

export interface NotificationDraft {
  webhooks?: Partial<Record<WebhookChannel, unknown>>
  email?: { subject: string; text: string }
}

export async function enqueueNotifications(
  settings: AppSettings,
  draft: NotificationDraft
): Promise<void> {
  const now = new Date().toISOString()
  const deliveries: Delivery[] = Object.entries(draft.webhooks ?? {})
    .filter(([channel, payload]) => Boolean(settings[channel as WebhookChannel]) && payload !== undefined)
    .map(([channel, payload]) => ({
      id: randomUUID(), channel: channel as WebhookChannel, payload,
      createdAt: now, attempts: 0, nextAttemptAt: now,
    }))

  const recipients = settings.alertEmailEnabled ? parseRecipients(settings.alertRecipients) : []
  if (recipients.length && draft.email) {
    deliveries.push({
      id: randomUUID(), channel: 'email', recipients,
      subject: draft.email.subject, text: draft.email.text,
      createdAt: now, attempts: 0, nextAttemptAt: now,
    })
  }
  if (!deliveries.length) return

  writeQueue([...readQueue(), ...deliveries])
  await retryPendingNotifications(settings)
}

async function deliver(delivery: Delivery, settings: AppSettings): Promise<void> {
  if (delivery.channel === 'email') {
    await sendEmail({
      host: settings.smtpHost,
      port: settings.smtpPort,
      user: settings.smtpUser,
      pass: settings.smtpPassword,
      from: settings.smtpFrom,
    }, delivery.recipients ?? [], delivery.subject ?? 'VynAI alert', delivery.text ?? '')
    return
  }

  const url = settings[delivery.channel]
  if (!url) throw new Error('Notification channel is no longer configured')
  const response = await fetch(url, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify(delivery.payload),
    signal: AbortSignal.timeout(10_000),
  })
  if (!response.ok) throw new Error(`Webhook returned HTTP ${response.status}`)
}

export async function retryPendingNotifications(settings: AppSettings): Promise<void> {
  if (processing) return
  processing = true
  try {
  const queue = readQueue()
  const now = Date.now()
  const due = queue.filter(item => !item.deliveredAt && Date.parse(item.nextAttemptAt) <= now)
    .slice(0, MAX_ATTEMPTS_PER_CYCLE)
  if (!due.length) return

  for (const delivery of due) {
    try {
      await deliver(delivery, settings)
      delivery.deliveredAt = new Date().toISOString()
      delivery.lastError = undefined
    } catch (error) {
      delivery.attempts += 1
      delivery.lastError = error instanceof Error ? error.message : 'Delivery failed'
      const delay = Math.min(30_000 * (2 ** Math.min(delivery.attempts - 1, 7)), MAX_BACKOFF_MS)
      delivery.nextAttemptAt = new Date(Date.now() + delay).toISOString()
    }
  }

  const cutoff = Date.now() - 30 * 24 * 60 * 60 * 1000
  writeQueue(queue.filter(item => !item.deliveredAt || Date.parse(item.deliveredAt) >= cutoff))
  } finally {
    processing = false
  }
}

export function getNotificationDeliverySummary(): NotificationDeliverySummary {
  const pending = readQueue().filter(item => !item.deliveredAt)
  return {
    pending: pending.length,
    retrying: pending.filter(item => item.attempts > 0).length,
    oldestPendingAt: pending.sort((a, b) => Date.parse(a.createdAt) - Date.parse(b.createdAt))[0]?.createdAt ?? null,
    lastError: pending.find(item => item.lastError)?.lastError ?? null,
  }
}
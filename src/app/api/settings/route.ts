import { NextRequest, NextResponse } from 'next/server'
import { loadSettings, saveSettings } from '@/lib/settings-store'
import { requireAdmin } from '@/lib/auth'
import { getNotificationDeliverySummary } from '@/lib/notification-outbox'

const SECRET_FIELDS = ['slackWebhookUrl', 'teamsWebhookUrl', 'customWebhookUrl', 'smtpPassword'] as const

function publicSettings(settings: ReturnType<typeof loadSettings>) {
  return {
    ...settings,
    slackWebhookUrl: '',
    teamsWebhookUrl: '',
    customWebhookUrl: '',
    smtpPassword: '',
    secretsConfigured: Object.fromEntries(SECRET_FIELDS.map(field => [field, Boolean(settings[field])])),
  }
}

export async function GET(req: NextRequest) {
  const deny = await requireAdmin(req)
  if (deny) return deny

  const settings = loadSettings()
  return NextResponse.json({
    ...publicSettings(settings),
    notificationDelivery: getNotificationDeliverySummary(),
    adminEmail: process.env.VYNAI_ADMIN_EMAIL ?? '',
    currentPort: process.env.PORT ?? '3010',
  })
}

export async function POST(req: NextRequest) {
  const deny = await requireAdmin(req)
  if (deny) return deny
  let body: Record<string, unknown>
  try { body = await req.json() } catch { return NextResponse.json({ error: 'Invalid JSON' }, { status: 400 }) }
  const current = loadSettings()
  const toSave: Record<string, unknown> = Object.fromEntries(
    Object.entries(body).filter(([key]) => key in current)
  )
  const clearSecrets = new Set(
    Array.isArray(body.clearSecrets)
      ? body.clearSecrets.filter((field): field is typeof SECRET_FIELDS[number] => SECRET_FIELDS.includes(field as typeof SECRET_FIELDS[number]))
      : []
  )
  for (const field of SECRET_FIELDS) {
    if (clearSecrets.has(field)) toSave[field] = ''
    else if (typeof toSave[field] !== 'string' || toSave[field] === '') delete toSave[field]
  }
  if (toSave.logRetentionDays !== undefined && (!Number.isInteger(toSave.logRetentionDays) || Number(toSave.logRetentionDays) < 0)) {
    return NextResponse.json({ error: 'logRetentionDays must be a non-negative integer' }, { status: 400 })
  }

  const saved = saveSettings(toSave as Partial<ReturnType<typeof loadSettings>>)
  return NextResponse.json({
    ...publicSettings(saved),
    notificationDelivery: getNotificationDeliverySummary(),
    adminEmail: process.env.VYNAI_ADMIN_EMAIL ?? '',
    currentPort: process.env.PORT ?? '3010',
  })
}

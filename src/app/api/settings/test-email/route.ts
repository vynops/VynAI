import { NextRequest, NextResponse } from 'next/server'
import { requireAdmin } from '@/lib/auth'
import { loadSettings } from '@/lib/settings-store'
import { sendEmail } from '@/lib/notifier'

export async function POST(req: NextRequest) {
  const deny = await requireAdmin(req)
  if (deny) return deny

  let body: { to?: string } = {}
  try {
    body = await req.json()
  } catch {
    // continue with default handling
  }

  const settings = loadSettings()
  const to = (body.to ?? '').trim()
  if (!to) {
    return NextResponse.json({ ok: false, message: 'Recipient email (to) is required' }, { status: 400 })
  }

  try {
    await sendEmail(
      {
        host: settings.smtpHost,
        port: settings.smtpPort,
        user: settings.smtpUser,
        pass: settings.smtpPassword,
        from: settings.smtpFrom,
      },
      [to],
      '[VynAI] Test email from Settings',
      `This is a test email from VynAI.\n\nSent at: ${new Date().toISOString()}`
    )
    return NextResponse.json({ ok: true, message: `Test email sent to ${to}` })
  } catch (err) {
    return NextResponse.json(
      { ok: false, message: err instanceof Error ? err.message : 'Email send failed' },
      { status: 502 }
    )
  }
}

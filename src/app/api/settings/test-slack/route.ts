import { NextRequest, NextResponse } from 'next/server'
import { requireAdmin } from '@/lib/auth'
import { loadSettings } from '@/lib/settings-store'

export async function POST(req: NextRequest) {
  const deny = await requireAdmin(req)
  if (deny) return deny

  let body: { webhookUrl?: string } = {}
  try {
    body = await req.json()
  } catch {
    // allow empty body and fallback to saved settings
  }

  const settings = loadSettings()
  const webhookUrl = (body.webhookUrl ?? settings.slackWebhookUrl ?? '').trim()
  if (!webhookUrl) {
    return NextResponse.json({ error: 'Slack webhook URL is required' }, { status: 400 })
  }

  const payload = {
    text: '*VynAI Test Alert*',
    blocks: [
      {
        type: 'section',
        text: {
          type: 'mrkdwn',
          text: '*VynAI Test Alert*\nSlack webhook test from Settings page.',
        },
      },
      {
        type: 'context',
        elements: [{ type: 'mrkdwn', text: `Sent at ${new Date().toUTCString()}` }],
      },
    ],
  }

  try {
    const res = await fetch(webhookUrl, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify(payload),
    })

    if (!res.ok) {
      const text = await res.text().catch(() => '')
      return NextResponse.json({ error: `Slack webhook failed (${res.status}): ${text || res.statusText}` }, { status: 502 })
    }

    return NextResponse.json({ ok: true })
  } catch (err) {
    const message = err instanceof Error ? err.message : 'Unknown error'
    return NextResponse.json({ error: `Failed to send test alert: ${message}` }, { status: 502 })
  }
}

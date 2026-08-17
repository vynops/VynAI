import { NextRequest, NextResponse } from 'next/server'
import { requireAdmin } from '@/lib/auth'
import { loadSettings } from '@/lib/settings-store'

type Channel = 'slackWebhookUrl' | 'teamsWebhookUrl' | 'customWebhookUrl'

export async function POST(req: NextRequest) {
  const deny = await requireAdmin(req)
  if (deny) return deny

  let body: { channel?: Channel; url?: string } = {}
  try {
    body = await req.json()
  } catch {
    // allow fallback to saved settings values
  }

  const channel = body.channel
  if (!channel) {
    return NextResponse.json({ ok: false, message: 'channel is required' }, { status: 400 })
  }

  const settings = loadSettings()
  const defaultUrl = channel === 'slackWebhookUrl'
    ? settings.slackWebhookUrl
    : channel === 'teamsWebhookUrl'
    ? settings.teamsWebhookUrl
    : settings.customWebhookUrl

  const url = (body.url ?? defaultUrl ?? '').trim()
  if (!url) {
    return NextResponse.json({ ok: false, message: 'Webhook URL is required' }, { status: 400 })
  }

  let parsed: URL
  try {
    parsed = new URL(url)
  } catch {
    return NextResponse.json({ ok: false, message: 'Invalid URL format' }, { status: 400 })
  }
  if (parsed.protocol !== 'http:' && parsed.protocol !== 'https:') {
    return NextResponse.json({ ok: false, message: 'URL must use HTTP or HTTPS' }, { status: 400 })
  }

  const started = Date.now()

  let payload: Record<string, unknown>
  if (channel === 'slackWebhookUrl') {
    payload = {
      text: '*VynAI Test Alert*',
      blocks: [
        {
          type: 'section',
          text: {
            type: 'mrkdwn',
            text: '*VynAI Test Alert*\nSlack webhook test from Settings page.',
          },
        },
      ],
    }
  } else if (channel === 'teamsWebhookUrl') {
    payload = {
      '@type': 'MessageCard',
      '@context': 'https://schema.org/extensions',
      summary: 'VynAI Test Alert',
      text: 'VynAI test notification from Settings page.',
    }
  } else {
    payload = {
      alert_type: 'test',
      title: 'VynAI Test Alert',
      description: 'Custom webhook test from Settings page.',
      severity: 'info',
      timestamp: new Date().toISOString(),
      source: 'vynai/settings',
    }
  }

  try {
    const res = await fetch(url, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify(payload),
    })

    if (!res.ok) {
      const text = await res.text().catch(() => '')
      return NextResponse.json(
        { ok: false, message: `Webhook failed (${res.status}): ${text || res.statusText}` },
        { status: 502 }
      )
    }

    return NextResponse.json({ ok: true, message: `Delivered in ${Date.now() - started}ms` })
  } catch (err) {
    return NextResponse.json(
      { ok: false, message: err instanceof Error ? err.message : 'Unknown error' },
      { status: 502 }
    )
  }
}

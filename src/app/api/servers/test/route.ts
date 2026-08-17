import { NextRequest, NextResponse } from 'next/server'
import { ollamaStatus } from '@/lib/ollama'
import { requireAdmin } from '@/lib/auth'

export async function POST(req: NextRequest) {
  const deny = await requireAdmin(req)
  if (deny) return deny

  let body: { url?: string }
  try { body = await req.json() } catch { return NextResponse.json({ error: 'Invalid JSON' }, { status: 400 }) }

  const { url } = body
  if (!url?.trim()) return NextResponse.json({ error: 'url is required' }, { status: 400 })
  try { new URL(url) } catch { return NextResponse.json({ error: 'Invalid URL' }, { status: 400 }) }

  const status = await ollamaStatus(url)

  if (!status.online) {
    return NextResponse.json({ error: `Cannot reach server: ${status.error}` }, { status: 502 })
  }

  return NextResponse.json({
    ok: true,
    version: status.version,
    modelCount: status.tags.length,
  })
}

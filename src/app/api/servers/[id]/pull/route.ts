import { NextRequest, NextResponse } from 'next/server'
import { getServer } from '@/lib/server-store'
import { requireAdmin } from '@/lib/auth'

export async function POST(req: NextRequest, { params }: { params: Promise<{ id: string }> }) {
  const deny = await requireAdmin(req)
  if (deny) return deny
  const { id } = await params
  const server = getServer(id)
  if (!server) return NextResponse.json({ error: 'Not found' }, { status: 404 })

  let body: { model?: string }
  try { body = await req.json() } catch { return NextResponse.json({ error: 'Invalid JSON' }, { status: 400 }) }

  const { model } = body
  if (!model?.trim()) return NextResponse.json({ error: 'model is required' }, { status: 400 })

  const controller = new AbortController()
  const timeout = setTimeout(() => controller.abort(), 10_000)
  let response: Response
  try {
    response = await fetch(`${server.url}/api/pull`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ model: model.trim(), stream: true }),
      signal: controller.signal,
    })
  } catch (error) {
    return NextResponse.json({ error: error instanceof Error ? error.message : 'Failed to reach Ollama server' }, { status: 502 })
  } finally {
    clearTimeout(timeout)
  }

  if (!response.ok) {
    const detail = await response.text().catch(() => '')
    return NextResponse.json({ error: detail || `Ollama returned HTTP ${response.status}` }, { status: 502 })
  }

  if (response.body) void response.body.pipeTo(new WritableStream()).catch(() => undefined)
  return NextResponse.json({ ok: true, message: `Pull accepted for ${model.trim()}` }, { status: 202 })
}

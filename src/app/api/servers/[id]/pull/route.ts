import { NextRequest, NextResponse } from 'next/server'
import { getServer } from '@/lib/server-store'

export async function POST(req: NextRequest, { params }: { params: Promise<{ id: string }> }) {
  const { id } = await params
  const server = getServer(id)
  if (!server) return NextResponse.json({ error: 'Not found' }, { status: 404 })

  let body: { model?: string }
  try { body = await req.json() } catch { return NextResponse.json({ error: 'Invalid JSON' }, { status: 400 }) }

  const { model } = body
  if (!model?.trim()) return NextResponse.json({ error: 'model is required' }, { status: 400 })

  // Kick off pull — Ollama streams progress; we fire-and-forget here
  // In a real implementation you'd stream the response back
  try {
    fetch(`${server.url}/api/pull`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ model: model.trim(), stream: false }),
    }).catch(() => null)

    return NextResponse.json({ ok: true, message: `Pull started for ${model}` })
  } catch {
    return NextResponse.json({ error: 'Failed to initiate pull' }, { status: 502 })
  }
}

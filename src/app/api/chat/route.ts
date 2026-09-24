import { NextRequest, NextResponse } from 'next/server'
import { getSessionUser } from '@/lib/auth'
import { listServers } from '@/lib/server-store'
import { ollamaStatus } from '@/lib/ollama'

interface ChatMessage { role: 'system' | 'user' | 'assistant'; content: string }

export async function POST(req: NextRequest) {
  const user = await getSessionUser(req)
  if (!user) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })

  let body: { model?: string; serverId?: string; messages?: ChatMessage[] }
  try { body = await req.json() } catch { return NextResponse.json({ error: 'Invalid JSON' }, { status: 400 }) }
  if (!body.model?.trim() || !Array.isArray(body.messages) || body.messages.length === 0) {
    return NextResponse.json({ error: 'model and messages are required' }, { status: 400 })
  }

  const servers = listServers()
  const candidates = body.serverId ? servers.filter(server => server.id === body.serverId) : servers
  let target: { url: string; name: string } | null = null
  for (const server of candidates) {
    const status = await ollamaStatus(server.url).catch(() => null)
    if (status?.online) { target = { url: server.url, name: server.name }; break }
  }
  if (!target) return NextResponse.json({ error: 'No online Ollama server is available' }, { status: 503 })

  const status = await ollamaStatus(target.url)
  const context = `You are VynAI Fleet Assistant. User: ${user.email}. Current fleet snapshot: server ${target.name} is online; available models: ${(status?.tags ?? []).map(model => model.name).join(', ') || 'unknown'}; loaded models: ${(status?.ps ?? []).map(model => model.name).join(', ') || 'none'}. Explain operational findings clearly. Do not claim to have changed infrastructure unless an approved automation job did it.`
  try {
    const response = await fetch(`${target.url}/api/chat`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ model: body.model.trim(), messages: [{ role: 'system', content: context }, ...body.messages], stream: false }),
    })
    if (!response.ok) return NextResponse.json({ error: `Ollama returned HTTP ${response.status}` }, { status: 502 })
    const result = await response.json()
    return NextResponse.json({
      message: result.message ?? { role: 'assistant', content: result.response ?? '' },
      serverName: target.name,
      model: body.model.trim(),
      usage: { prompt_tokens: result.prompt_eval_count ?? 0, completion_tokens: result.eval_count ?? 0 },
    })
  } catch {
    return NextResponse.json({ error: 'Failed to reach Ollama server' }, { status: 502 })
  }
}

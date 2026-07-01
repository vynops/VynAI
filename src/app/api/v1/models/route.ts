import { NextRequest, NextResponse } from 'next/server'
import { validateKey } from '@/lib/key-store'
import { listServers } from '@/lib/server-store'
import { ollamaStatus } from '@/lib/ollama'

function errorJson(status: number, message: string) {
  return NextResponse.json({ error: { message, type: 'invalid_request_error' } }, { status })
}

export async function GET(req: NextRequest) {
  // Auth
  const token = (req.headers.get('authorization') ?? '').replace('Bearer ', '').trim()
  if (!token || !validateKey(token)) return errorJson(401, 'Invalid or missing API key')

  // Collect all models from all online servers
  const servers = listServers()
  const results = await Promise.allSettled(
    servers.map(srv => ollamaStatus(srv.url))
  )

  const seen = new Set<string>()
  const models: Array<{ id: string; object: string; created: number; owned_by: string }> = []

  results.forEach((r) => {
    if (r.status !== 'fulfilled' || !r.value.online) return
    for (const tag of r.value.tags) {
      if (!seen.has(tag.name)) {
        seen.add(tag.name)
        models.push({
          id: tag.name,
          object: 'model',
          created: Math.floor(Date.now() / 1000),
          owned_by: 'ollama',
        })
      }
    }
  })

  return NextResponse.json({ object: 'list', data: models })
}

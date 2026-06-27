import { NextRequest, NextResponse } from 'next/server'
import { getServer } from '@/lib/server-store'
import { fetchServerMetrics } from '@/lib/ssh'

export async function GET(_req: NextRequest, { params }: { params: Promise<{ id: string }> }) {
  const { id } = await params
  const server = getServer(id)
  if (!server) return NextResponse.json({ error: 'Not found' }, { status: 404 })

  if (!server.sshUser || !server.sshPassword) {
    return NextResponse.json({ error: 'SSH not configured for this server' }, { status: 400 })
  }

  // Extract host from Ollama URL (e.g. http://10.1.14.249:11434 → 10.1.14.249)
  let host: string
  try {
    host = new URL(server.url).hostname
  } catch {
    return NextResponse.json({ error: 'Invalid server URL' }, { status: 400 })
  }

  const metrics = await fetchServerMetrics({
    host,
    port: server.sshPort ?? 22,
    username: server.sshUser,
    password: server.sshPassword,
  })

  return NextResponse.json(metrics)
}

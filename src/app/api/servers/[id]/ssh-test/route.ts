import { NextRequest, NextResponse } from 'next/server'
import { fetchServerMetrics } from '@/lib/ssh'
import { requireAdmin } from '@/lib/auth'
import { getServer } from '@/lib/server-store'

export async function POST(req: NextRequest, { params }: { params: Promise<{ id: string }> }) {
  const deny = await requireAdmin(req)
  if (deny) return deny

  const { id } = await params
  const server = getServer(id)
  if (!server) return NextResponse.json({ error: 'Not found' }, { status: 404 })

  let body: { sshUser?: string; sshPassword?: string; sshPort?: number }
  try { body = await req.json() } catch { return NextResponse.json({ error: 'Invalid JSON' }, { status: 400 }) }

  const { sshUser, sshPassword, sshPort } = body
  if (!sshUser || !sshPassword) {
    return NextResponse.json({ error: 'sshUser and sshPassword are required' }, { status: 400 })
  }

  const port = Number.isInteger(sshPort) ? sshPort! : 22
  if (port < 1 || port > 65535) {
    return NextResponse.json({ error: 'sshPort must be between 1 and 65535' }, { status: 400 })
  }

  let host: string
  try {
    host = new URL(server.url).hostname
  } catch {
    return NextResponse.json({ error: 'Invalid server URL' }, { status: 400 })
  }

  const metrics = await fetchServerMetrics({ host, port, username: sshUser, password: sshPassword })

  if (metrics.error) {
    return NextResponse.json({ error: metrics.error }, { status: 502 })
  }

  return NextResponse.json({
    ok: true,
    gpuCount: metrics.gpus.length,
    gpuNames: metrics.gpus.map(g => g.name),
    ramTotalGiB: (metrics.ramTotalMiB / 1024).toFixed(1),
    diskTotalGiB: metrics.diskTotalGiB,
  })
}

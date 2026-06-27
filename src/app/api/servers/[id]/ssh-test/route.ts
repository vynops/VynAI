import { NextRequest, NextResponse } from 'next/server'
import { fetchServerMetrics } from '@/lib/ssh'

export async function POST(req: NextRequest, { params }: { params: Promise<{ id: string }> }) {
  let body: { sshUser?: string; sshPassword?: string; sshPort?: number; host?: string }
  try { body = await req.json() } catch { return NextResponse.json({ error: 'Invalid JSON' }, { status: 400 }) }

  const { sshUser, sshPassword, sshPort, host } = body
  if (!sshUser || !sshPassword || !host) {
    return NextResponse.json({ error: 'host, sshUser, and sshPassword are required' }, { status: 400 })
  }

  const metrics = await fetchServerMetrics({ host, port: sshPort ?? 22, username: sshUser, password: sshPassword })

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

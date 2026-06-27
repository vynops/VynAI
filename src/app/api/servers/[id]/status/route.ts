import { NextRequest, NextResponse } from 'next/server'
import { getServer } from '@/lib/server-store'
import { ollamaStatus } from '@/lib/ollama'

export async function GET(_req: NextRequest, { params }: { params: Promise<{ id: string }> }) {
  const { id } = await params
  const server = getServer(id)
  if (!server) return NextResponse.json({ error: 'Not found' }, { status: 404 })

  const status = await ollamaStatus(server.url)
  const vramUsedBytes = status.ps.reduce((s, m) => s + (m.size_vram ?? 0), 0)

  // Strip sshPassword, but expose sshUser so client knows SSH is configured
  const { sshPassword: _p, ...serverSafe } = server

  return NextResponse.json({
    ...serverSafe,
    ...status,
    totalModels: status.tags.length,
    loadedCount: status.ps.length,
    vramUsedBytes,
  })
}

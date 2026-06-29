import { NextRequest, NextResponse } from 'next/server'
import { getServer } from '@/lib/server-store'
import { ollamaStatus } from '@/lib/ollama'

export async function GET(_req: NextRequest, { params }: { params: Promise<{ id: string }> }) {
  try {
  const { id } = await params
  console.log('[status] id=', id)
  const server = getServer(id)
  console.log('[status] server=', server ? server.id : 'NULL')
  if (!server) return NextResponse.json({ error: 'Not found', id }, { status: 404 })

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
  } catch (err) {
    console.error('[status] CAUGHT ERROR:', err)
    return NextResponse.json({ error: String(err) }, { status: 500 })
  }
}


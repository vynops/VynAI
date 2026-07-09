import { NextRequest, NextResponse } from 'next/server'
import { getServer, removeServer, updateServer } from '@/lib/server-store'
import { requireAdmin } from '@/lib/auth'

export async function GET(_req: NextRequest, { params }: { params: Promise<{ id: string }> }) {
  const { id } = await params
  const server = getServer(id)
  if (!server) return NextResponse.json({ error: 'Not found' }, { status: 404 })
  // Never expose SSH password to client
  const { sshPassword: _p, ...safe } = server
  return NextResponse.json(safe)
}

export async function PATCH(req: NextRequest, { params }: { params: Promise<{ id: string }> }) {
  const deny = await requireAdmin(req)
  if (deny) return deny
  const { id } = await params
  let body: Record<string, unknown>
  try { body = await req.json() } catch { return NextResponse.json({ error: 'Invalid JSON' }, { status: 400 }) }
  const updated = updateServer(id, body as never)
  if (!updated) return NextResponse.json({ error: 'Not found' }, { status: 404 })
  const { sshPassword: _p, ...safe } = updated
  return NextResponse.json(safe)
}

export async function DELETE(req: NextRequest, { params }: { params: Promise<{ id: string }> }) {
  const deny = await requireAdmin(req)
  if (deny) return deny
  const { id } = await params
  const ok = removeServer(id)
  if (!ok) return NextResponse.json({ error: 'Not found' }, { status: 404 })
  return NextResponse.json({ ok: true })
}

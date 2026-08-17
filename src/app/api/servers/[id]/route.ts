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

  const allowed = new Set(['name', 'url', 'sshUser', 'sshPassword', 'sshPort'])
  const unknown = Object.keys(body).filter((k) => !allowed.has(k))
  if (unknown.length) {
    return NextResponse.json({ error: `Unknown fields: ${unknown.join(', ')}` }, { status: 400 })
  }

  const patch: {
    name?: string
    url?: string
    sshUser?: string
    sshPassword?: string
    sshPort?: number
  } = {}

  if (body.name !== undefined) {
    if (typeof body.name !== 'string' || !body.name.trim()) {
      return NextResponse.json({ error: 'name must be a non-empty string' }, { status: 400 })
    }
    patch.name = body.name.trim()
  }

  if (body.url !== undefined) {
    if (typeof body.url !== 'string' || !body.url.trim()) {
      return NextResponse.json({ error: 'url must be a non-empty string' }, { status: 400 })
    }
    try {
      const parsed = new URL(body.url)
      if (parsed.protocol !== 'http:' && parsed.protocol !== 'https:') {
        return NextResponse.json({ error: 'url must use http or https' }, { status: 400 })
      }
      patch.url = body.url.trim().replace(/\/+$/, '')
    } catch {
      return NextResponse.json({ error: 'Invalid URL format' }, { status: 400 })
    }
  }

  if (body.sshUser !== undefined) {
    if (typeof body.sshUser !== 'string' || !body.sshUser.trim()) {
      return NextResponse.json({ error: 'sshUser must be a non-empty string' }, { status: 400 })
    }
    patch.sshUser = body.sshUser.trim()
  }

  if (body.sshPassword !== undefined) {
    if (typeof body.sshPassword !== 'string' || !body.sshPassword.trim()) {
      return NextResponse.json({ error: 'sshPassword must be a non-empty string' }, { status: 400 })
    }
    patch.sshPassword = body.sshPassword
  }

  if (body.sshPort !== undefined) {
    if (!Number.isInteger(body.sshPort) || (body.sshPort as number) < 1 || (body.sshPort as number) > 65535) {
      return NextResponse.json({ error: 'sshPort must be an integer between 1 and 65535' }, { status: 400 })
    }
    patch.sshPort = body.sshPort as number
  }

  const updated = updateServer(id, patch)
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

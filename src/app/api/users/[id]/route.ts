import { NextRequest, NextResponse } from 'next/server'
import { verifySession } from '@/lib/auth'
import { updateUser, deleteUser, getUserById } from '@/lib/user-store'

export async function PATCH(req: NextRequest, { params }: { params: Promise<{ id: string }> }) {
  const token = req.cookies.get('vynai_session')?.value
  if (!token) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })
  const session = await verifySession(token)
  if (!session) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })

  const { id } = await params
  let body: { name?: string; role?: 'admin' | 'viewer'; active?: boolean }
  try { body = await req.json() } catch { return NextResponse.json({ error: 'Invalid JSON' }, { status: 400 }) }

  const ok = updateUser(id, body)
  if (!ok) return NextResponse.json({ error: 'Not found' }, { status: 404 })
  const { passwordHash: _ph, ...user } = getUserById(id)!
  return NextResponse.json(user)
}

export async function DELETE(req: NextRequest, { params }: { params: Promise<{ id: string }> }) {
  const token = req.cookies.get('vynai_session')?.value
  if (!token) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })
  const session = await verifySession(token)
  if (!session) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })

  const { id } = await params

  // Prevent deleting the last admin
  const { listUsers } = await import('@/lib/user-store')
  const admins = listUsers().filter(u => u.role === 'admin' && u.active)
  const target = admins.find(u => u.id === id)
  if (target && admins.length <= 1) {
    return NextResponse.json({ error: 'Cannot delete the last admin account' }, { status: 400 })
  }

  const ok = deleteUser(id)
  if (!ok) return NextResponse.json({ error: 'Not found' }, { status: 404 })
  return NextResponse.json({ ok: true })
}

import { NextRequest, NextResponse } from 'next/server'
import { getSessionUser, requireAdmin } from '@/lib/auth'
import { updateUser, deleteUser, getUserById, changePassword, verifyPassword, listUsers } from '@/lib/user-store'

export async function PATCH(req: NextRequest, { params }: { params: Promise<{ id: string }> }) {
  const session = await getSessionUser(req)
  if (!session) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })

  const { id } = await params
  const targetUser = getUserById(id)
  if (!targetUser) return NextResponse.json({ error: 'User not found' }, { status: 404 })

  const isAdmin = session.role === 'admin'
  const isSelf = targetUser.email.toLowerCase() === session.email.toLowerCase()

  if (!isAdmin && !isSelf) {
    return NextResponse.json({ error: 'Forbidden' }, { status: 403 })
  }

  let body: { name?: string; role?: 'admin' | 'viewer'; active?: boolean; password?: string; currentPassword?: string }
  try { body = await req.json() } catch { return NextResponse.json({ error: 'Invalid JSON' }, { status: 400 }) }

  // Non-admins cannot change role or active status
  if (!isAdmin && (body.role !== undefined || body.active !== undefined)) {
    return NextResponse.json({ error: 'Only admins can modify user roles or active status' }, { status: 403 })
  }

  // Handle password update
  if (body.password !== undefined) {
    if (typeof body.password !== 'string' || body.password.length < 8) {
      return NextResponse.json({ error: 'Password must be at least 8 characters' }, { status: 400 })
    }

    // Require current password when user changes their own password
    if (isSelf) {
      if (!body.currentPassword) {
        return NextResponse.json({ error: 'Current password is required' }, { status: 400 })
      }
      if (!verifyPassword(body.currentPassword, targetUser.passwordHash)) {
        return NextResponse.json({ error: 'Current password is incorrect' }, { status: 401 })
      }
    }

    changePassword(id, body.password)
  }

  // Handle name / role / active updates
  const updates: Partial<Pick<typeof targetUser, 'name' | 'role' | 'active'>> = {}
  if (body.name !== undefined) updates.name = body.name
  if (isAdmin && body.role !== undefined) updates.role = body.role
  if (isAdmin && body.active !== undefined) updates.active = body.active

  if (Object.keys(updates).length > 0) {
    updateUser(id, updates)
  }

  const updatedUser = getUserById(id)!
  const { passwordHash: _ph, ...userClean } = updatedUser
  return NextResponse.json(userClean)
}

export async function DELETE(req: NextRequest, { params }: { params: Promise<{ id: string }> }) {
  const deny = await requireAdmin(req)
  if (deny) return deny

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

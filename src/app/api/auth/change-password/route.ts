import { NextRequest, NextResponse } from 'next/server'
import { getSessionUser, sessionCookieOptions } from '@/lib/auth'
import { verifyPassword, changePassword } from '@/lib/user-store'

export async function POST(req: NextRequest) {
  const user = await getSessionUser(req)
  if (!user) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })

  let body: { currentPassword?: string; newPassword?: string }
  try { body = await req.json() } catch { return NextResponse.json({ error: 'Invalid JSON' }, { status: 400 }) }

  if (!body.currentPassword) return NextResponse.json({ error: 'currentPassword is required' }, { status: 400 })
  if (!body.newPassword || body.newPassword.length < 8) {
    return NextResponse.json({ error: 'newPassword must be at least 8 characters' }, { status: 400 })
  }

  if (!verifyPassword(body.currentPassword, user.passwordHash)) {
    return NextResponse.json({ error: 'Current password is incorrect' }, { status: 401 })
  }

  changePassword(user.id, body.newPassword)
  const response = NextResponse.json({ ok: true })
  response.cookies.set(sessionCookieOptions('', true))
  return response
}

import { NextRequest, NextResponse } from 'next/server'
import { verifySession } from '@/lib/auth'
import { getUserByEmail, verifyPassword, changePassword } from '@/lib/user-store'

export async function POST(req: NextRequest) {
  const token = req.cookies.get('vynai_session')?.value
  if (!token) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })
  const session = await verifySession(token)
  if (!session) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })

  let body: { currentPassword?: string; newPassword?: string }
  try { body = await req.json() } catch { return NextResponse.json({ error: 'Invalid JSON' }, { status: 400 }) }

  if (!body.currentPassword) return NextResponse.json({ error: 'currentPassword is required' }, { status: 400 })
  if (!body.newPassword || body.newPassword.length < 8) {
    return NextResponse.json({ error: 'newPassword must be at least 8 characters' }, { status: 400 })
  }

  const user = getUserByEmail(session.email)
  if (!user) return NextResponse.json({ error: 'User not found' }, { status: 404 })

  if (!verifyPassword(body.currentPassword, user.passwordHash)) {
    return NextResponse.json({ error: 'Current password is incorrect' }, { status: 401 })
  }

  changePassword(user.id, body.newPassword)
  return NextResponse.json({ ok: true })
}

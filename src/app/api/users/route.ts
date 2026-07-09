import { NextRequest, NextResponse } from 'next/server'
import { verifySession, requireAdmin } from '@/lib/auth'
import { listUsers, createUser, getUserByEmail } from '@/lib/user-store'

export async function GET(req: NextRequest) {
  const token = req.cookies.get('vynai_session')?.value
  if (!token) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })
  const session = await verifySession(token)
  if (!session) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })

  // Strip passwordHash before returning
  return NextResponse.json(listUsers().map(({ passwordHash: _ph, ...u }) => u))
}

export async function POST(req: NextRequest) {
  const deny = await requireAdmin(req)
  if (deny) return deny

  let body: { email?: string; name?: string; password?: string; role?: 'admin' | 'viewer' }
  try { body = await req.json() } catch { return NextResponse.json({ error: 'Invalid JSON' }, { status: 400 }) }

  if (!body.email?.trim()) return NextResponse.json({ error: 'email is required' }, { status: 400 })
  if (!body.name?.trim()) return NextResponse.json({ error: 'name is required' }, { status: 400 })
  if (!body.password || body.password.length < 8) return NextResponse.json({ error: 'password must be at least 8 characters' }, { status: 400 })
  if (!['admin', 'viewer'].includes(body.role ?? '')) return NextResponse.json({ error: 'role must be admin or viewer' }, { status: 400 })

  if (getUserByEmail(body.email)) return NextResponse.json({ error: 'Email already in use' }, { status: 409 })

  const { passwordHash: _ph, ...user } = createUser({
    email: body.email, name: body.name, password: body.password, role: body.role!,
  })
  return NextResponse.json(user, { status: 201 })
}

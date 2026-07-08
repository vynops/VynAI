import { NextRequest, NextResponse } from 'next/server'
import { verifySession } from '@/lib/auth'
import { getUserByEmail } from '@/lib/user-store'

export async function GET(req: NextRequest) {
  const token = req.cookies.get('vynai_session')?.value
  if (!token) return NextResponse.json(null, { status: 401 })
  const session = await verifySession(token)
  if (!session) return NextResponse.json(null, { status: 401 })

  const user = getUserByEmail(session.email)
  if (user) {
    return NextResponse.json({ id: user.id, email: user.email, name: user.name, role: user.role })
  }
  // Fallback for env-var-only setup (no user store yet)
  const name = session.email.split('@')[0]
  return NextResponse.json({ email: session.email, name, role: 'admin' })
}

import { NextRequest, NextResponse } from 'next/server'
import { signSession, sessionCookieOptions, safeEqual } from '@/lib/auth'
import { validateLogin, ensureAdminFromEnv, listUsers } from '@/lib/user-store'

export async function POST(req: NextRequest) {
  let body: { email?: string; password?: string }

  try {
    body = await req.json()
  } catch {
    return NextResponse.json({ error: 'Invalid request body' }, { status: 400 })
  }

  const { email = '', password = '' } = body

  // Seed admin from env on first boot (if no users exist yet)
  ensureAdminFromEnv()

  // Try user store first
  if (listUsers().length > 0) {
    const user = validateLogin(email, password)
    if (!user) return NextResponse.json({ error: 'Invalid email or password' }, { status: 401 })
    const token = await signSession(user.email)
    const res = NextResponse.json({ ok: true })
    res.cookies.set(sessionCookieOptions(token))
    return res
  }

  // Fallback: env-var only (no users seeded yet)
  const adminEmail = process.env.VYNAI_ADMIN_EMAIL
  const adminPassword = process.env.VYNAI_ADMIN_PASSWORD
  if (!adminEmail || !adminPassword) {
    return NextResponse.json(
      { error: 'Admin credentials not configured. Set VYNAI_ADMIN_EMAIL and VYNAI_ADMIN_PASSWORD in .env.local' },
      { status: 500 }
    )
  }
  const emailOk = safeEqual(email, adminEmail)
  const passwordOk = safeEqual(password, adminPassword)
  if (!emailOk || !passwordOk) return NextResponse.json({ error: 'Invalid email or password' }, { status: 401 })

  const token = await signSession(email)
  const res = NextResponse.json({ ok: true })
  res.cookies.set(sessionCookieOptions(token))
  return res
}

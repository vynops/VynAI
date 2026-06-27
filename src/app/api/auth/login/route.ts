import { NextRequest, NextResponse } from 'next/server'
import { signSession, sessionCookieOptions, safeEqual } from '@/lib/auth'

export async function POST(req: NextRequest) {
  let body: { email?: string; password?: string }

  try {
    body = await req.json()
  } catch {
    return NextResponse.json({ error: 'Invalid request body' }, { status: 400 })
  }

  const adminEmail = process.env.VYNAI_ADMIN_EMAIL
  const adminPassword = process.env.VYNAI_ADMIN_PASSWORD

  if (!adminEmail || !adminPassword) {
    return NextResponse.json(
      { error: 'Admin credentials not configured. Set VYNAI_ADMIN_EMAIL and VYNAI_ADMIN_PASSWORD in .env.local' },
      { status: 500 }
    )
  }

  const { email = '', password = '' } = body

  const emailOk = safeEqual(email, adminEmail)
  const passwordOk = safeEqual(password, adminPassword)

  if (!emailOk || !passwordOk) {
    // Uniform error — never reveal which field is wrong
    return NextResponse.json({ error: 'Invalid email or password' }, { status: 401 })
  }

  const token = await signSession(email)
  const res = NextResponse.json({ ok: true })
  res.cookies.set(sessionCookieOptions(token))
  return res
}

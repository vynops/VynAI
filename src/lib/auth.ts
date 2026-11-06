import { SignJWT, jwtVerify } from 'jose'
import { timingSafeEqual } from 'crypto'

const COOKIE_NAME = 'vynai_session'
const EXPIRY = '7d'

function getSecret(): Uint8Array {
  const secret = process.env.VYNAI_SECRET
  if (!secret) {
    throw new Error('VYNAI_SECRET must be configured')
  }
  return new TextEncoder().encode(secret)
}

export async function signSession(email: string, authVersion = 0): Promise<string> {
  return new SignJWT({ sub: email, authVersion })
    .setProtectedHeader({ alg: 'HS256' })
    .setIssuedAt()
    .setExpirationTime(EXPIRY)
    .sign(getSecret())
}

export async function verifySession(token: string): Promise<{ email: string; authVersion: number } | null> {
  try {
    const { payload } = await jwtVerify(token, getSecret())
    if (typeof payload.sub !== 'string') return null
    const authVersion = Number.isSafeInteger(payload.authVersion) && Number(payload.authVersion) >= 0
      ? Number(payload.authVersion)
      : 0
    return { email: payload.sub, authVersion }
  } catch {
    return null
  }
}

export const SESSION_COOKIE = COOKIE_NAME

export function sessionCookieOptions(token: string, expire = false) {
  return {
    name: COOKIE_NAME,
    value: token,
    httpOnly: true,
    secure: process.env.VYNAI_SECURE_COOKIE === 'true' ||
      (process.env.NODE_ENV === 'production' && process.env.VYNAI_SECURE_COOKIE !== 'false'),
    sameSite: 'lax' as const,
    path: '/',
    maxAge: expire ? 0 : 7 * 24 * 60 * 60,
  }
}

/** Timing-safe string comparison — prevents brute-force timing attacks */
export function safeEqual(a: string, b: string): boolean {
  if (a.length !== b.length) {
    // Run a dummy comparison so duration is constant
    const dummy = Buffer.alloc(b.length)
    timingSafeEqual(dummy, dummy)
    return false
  }
  return timingSafeEqual(Buffer.from(a), Buffer.from(b))
}

import type { NextRequest } from 'next/server'
import { NextResponse } from 'next/server'
import { getUserByEmail } from '@/lib/user-store'

/**
 * Resolves the current session user from a request.
 * Returns the user record or null if unauthenticated / not found.
 */
export async function getSessionUser(req: NextRequest) {
  const token = req.cookies.get('vynai_session')?.value
  if (!token) return null
  const session = await verifySession(token)
  if (!session) return null
  const user = getUserByEmail(session.email)
  if (!user?.active || (user.authVersion ?? 0) !== session.authVersion) return null
  return user
}

/**
 * Guard for admin-only routes.
 * Returns a 401/403 NextResponse if the request is not from an active admin,
 * or null if the check passes (allowing the handler to continue).
 */
export async function requireAdmin(req: NextRequest): Promise<NextResponse | null> {
  const user = await getSessionUser(req)
  if (!user) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })
  if (user.role !== 'admin') return NextResponse.json({ error: 'Forbidden — admin role required' }, { status: 403 })
  return null
}

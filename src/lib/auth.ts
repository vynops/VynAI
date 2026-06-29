import { SignJWT, jwtVerify } from 'jose'

const COOKIE_NAME = 'vynai_session'
const EXPIRY = '7d'

function getSecret(): Uint8Array {
  const secret = process.env.VYNAI_SECRET
  if (!secret) {
    console.warn('[VynAI] VYNAI_SECRET not set — using insecure dev default. Set it in .env.local.')
  }
  return new TextEncoder().encode(secret ?? 'dev-secret-do-not-use-in-production')
}

export async function signSession(email: string): Promise<string> {
  return new SignJWT({ sub: email })
    .setProtectedHeader({ alg: 'HS256' })
    .setIssuedAt()
    .setExpirationTime(EXPIRY)
    .sign(getSecret())
}

export async function verifySession(token: string): Promise<{ email: string } | null> {
  try {
    const { payload } = await jwtVerify(token, getSecret())
    return { email: payload.sub as string }
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
    secure: process.env.VYNAI_SECURE_COOKIE === 'true',
    sameSite: 'lax' as const,
    path: '/',
    maxAge: expire ? 0 : 7 * 24 * 60 * 60,
  }
}

/** Timing-safe string comparison — prevents brute-force timing attacks */
export function safeEqual(a: string, b: string): boolean {
  const { timingSafeEqual } = require('crypto') as typeof import('crypto')
  if (a.length !== b.length) {
    // Run a dummy comparison so duration is constant
    const dummy = Buffer.alloc(b.length)
    timingSafeEqual(dummy, dummy)
    return false
  }
  return timingSafeEqual(Buffer.from(a), Buffer.from(b))
}

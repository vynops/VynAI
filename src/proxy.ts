import { NextRequest, NextResponse } from 'next/server'
import { getSessionUser, sessionCookieOptions } from '@/lib/auth'

const PUBLIC_PATHS = ['/login', '/api/auth', '/api/v1']

export async function proxy(req: NextRequest) {
  const { pathname } = req.nextUrl

  // Allow public paths and Next.js internals
  if (PUBLIC_PATHS.some((p) => pathname.startsWith(p))) {
    return NextResponse.next()
  }

  const token = req.cookies.get('vynai_session')?.value

  if (!token) {
    const loginUrl = new URL('/login', req.url)
    loginUrl.searchParams.set('from', pathname)
    return NextResponse.redirect(loginUrl)
  }

  if (await getSessionUser(req)) return NextResponse.next()

  const loginUrl = new URL('/login', req.url)
  const res = NextResponse.redirect(loginUrl)
  res.cookies.set(sessionCookieOptions('', true))
  return res
}

export const config = {
  matcher: ['/((?!_next/static|_next/image|favicon\\.ico).*)'],
}

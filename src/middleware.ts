import { NextRequest, NextResponse } from 'next/server'
import { jwtVerify } from 'jose'

const SECRET = () => new TextEncoder().encode(
  process.env.VYNAI_SECRET ?? 'dev-secret-do-not-use-in-production'
)

const PUBLIC_PATHS = ['/login', '/api/auth', '/api/v1']

export async function middleware(req: NextRequest) {
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

  try {
    await jwtVerify(token, SECRET())
    return NextResponse.next()
  } catch {
    // Token invalid or expired — clear the cookie and redirect
    const loginUrl = new URL('/login', req.url)
    const res = NextResponse.redirect(loginUrl)
    res.cookies.set('vynai_session', '', { maxAge: 0, path: '/' })
    return res
  }
}

export const config = {
  matcher: ['/((?!_next/static|_next/image|favicon\\.ico).*)'],
}

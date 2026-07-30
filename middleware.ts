import { NextResponse } from 'next/server'
import type { NextRequest } from 'next/server'

// Middleware runs in Edge Runtime — can't use libsql file: URLs.
// Fast cookie presence check here; full session validation happens in
// each route handler (Node.js runtime) via auth() from lib/auth.ts.
export function middleware(req: NextRequest) {
  const { pathname } = req.nextUrl

  const sessionToken =
    req.cookies.get('authjs.session-token') ??
    req.cookies.get('__Secure-authjs.session-token')
  const isAuthed = !!sessionToken

  if (!isAuthed) {
    if (pathname.startsWith('/api/')) {
      return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })
    }
    return NextResponse.redirect(new URL('/', req.url))
  }

  return NextResponse.next()
}

export const config = {
  matcher: ['/scan/:path*', '/history/:path*', '/api/((?!auth).*)'],
}

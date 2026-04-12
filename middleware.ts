import { NextResponse } from 'next/server'
import { jwtVerify } from 'jose'
import type { NextRequest } from 'next/server'

const COOKIE_NAME = 'primr_session'

function getSecret() {
  return new TextEncoder().encode(process.env.AUTH_SECRET!)
}

// Known protected sub-paths under /creator/*. Anything else matching a single
// segment under /creator/ (e.g. /creator/{uuid}) is the PUBLIC creator profile
// page and must be allowed through without auth.
const PROTECTED_CREATOR_SUBPATHS = [
  'new',
  'edit',
  'preview',
  'video-status',
  'courses',
  'lessons',
  'monetization',
  'students',
]

function isPublicCreatorProfilePath(pathname: string): boolean {
  // Match /creator/<something> with no further segments.
  // /creator and /creator/ are the protected dashboard — not public.
  const match = pathname.match(/^\/creator\/([^/]+)\/?$/)
  if (!match) return false
  const segment = match[1]
  if (!segment) return false
  if (PROTECTED_CREATOR_SUBPATHS.includes(segment)) return false
  return true
}

export async function middleware(req: NextRequest) {
  // Let the public creator profile page through without auth.
  if (isPublicCreatorProfilePath(req.nextUrl.pathname)) {
    return NextResponse.next()
  }

  // Let /learn/* through without auth — the page component handles
  // auth-gating itself and shows a paywall for paid content.
  if (req.nextUrl.pathname.startsWith('/learn/')) {
    return NextResponse.next()
  }

  const token = req.cookies.get(COOKIE_NAME)?.value

  if (!token) {
    return redirectToLogin(req)
  }

  try {
    await jwtVerify(token, getSecret())
    return NextResponse.next()
  } catch {
    return redirectToLogin(req)
  }
}

function redirectToLogin(req: NextRequest) {
  const authUrl = process.env.PRIMR_AUTH_URL ?? 'http://localhost:3001'
  const loginUrl = new URL(`${authUrl}/login`)
  // Behind NGINX, req.url has the internal host (localhost:3000).
  // Reconstruct the public URL from forwarded headers instead.
  const proto = req.headers.get('x-forwarded-proto') ?? req.nextUrl.protocol.replace(':', '')
  const host = req.headers.get('host') ?? req.nextUrl.host
  const callbackUrl = `${proto}://${host}${req.nextUrl.pathname}${req.nextUrl.search}`
  loginUrl.searchParams.set('callbackUrl', callbackUrl)
  return NextResponse.redirect(loginUrl)
}

export const config = {
  matcher: ['/creator/:path*', '/my-primr/:path*', '/learn/:path*', '/docs/:path*', '/account/:path*', '/api/account/:path*', '/api/invite/:path*', '/api/course-invite/:path*', '/api/pexels/:path*'],
  // Note: /lesson is NOT protected — public showcase route
}

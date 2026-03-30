import { NextResponse } from 'next/server'
import { jwtVerify } from 'jose'
import type { NextRequest } from 'next/server'

const COOKIE_NAME = 'primr_session'

function getSecret() {
  return new TextEncoder().encode(process.env.AUTH_SECRET!)
}

export async function middleware(req: NextRequest) {
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
  matcher: ['/creator/:path*', '/my-primr/:path*', '/learn/:path*', '/account/:path*', '/api/invite/:path*', '/api/course-invite/:path*', '/api/pexels/:path*'],
  // Note: /lesson is NOT protected — public showcase route
}

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
  loginUrl.searchParams.set('callbackUrl', req.url)
  return NextResponse.redirect(loginUrl)
}

export const config = {
  matcher: ['/creator/:path*', '/my-primr/:path*', '/learn/:path*', '/api/invite/:path*', '/api/course-invite/:path*'],
}

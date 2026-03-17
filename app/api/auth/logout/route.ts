import { NextResponse } from 'next/server'

export function GET() {
  const authUrl = process.env.PRIMR_AUTH_URL ?? 'http://localhost:3001'
  const res = NextResponse.redirect(new URL('/login', authUrl))
  res.cookies.delete('primr_session')
  return res
}

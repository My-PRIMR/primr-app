import { NextResponse } from 'next/server'

export function GET() {
  const authUrl = process.env.PRIMR_AUTH_URL ?? 'http://localhost:3001'
  return NextResponse.redirect(new URL('/logout', authUrl))
}

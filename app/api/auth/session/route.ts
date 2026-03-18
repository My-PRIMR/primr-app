import { NextRequest, NextResponse } from 'next/server'
import { getSession } from '@/session'

const MARKETING_ORIGINS = [
  'http://localhost:3002', // primr-marketing dev
  process.env.MARKETING_URL,
].filter(Boolean) as string[]

function corsHeaders(origin: string | null) {
  const allowed = origin && MARKETING_ORIGINS.includes(origin) ? origin : MARKETING_ORIGINS[0]
  return {
    'Access-Control-Allow-Origin': allowed,
    'Access-Control-Allow-Credentials': 'true',
    'Access-Control-Allow-Methods': 'GET, OPTIONS',
    'Access-Control-Allow-Headers': 'Content-Type',
  }
}

export async function OPTIONS(req: NextRequest) {
  const origin = req.headers.get('origin')
  return new NextResponse(null, { status: 204, headers: corsHeaders(origin) })
}

export async function GET(req: NextRequest) {
  const origin = req.headers.get('origin')
  const session = await getSession()
  return NextResponse.json(
    session ? { loggedIn: true, name: session.user.name, role: session.user.productRole } : { loggedIn: false },
    { headers: corsHeaders(origin) },
  )
}

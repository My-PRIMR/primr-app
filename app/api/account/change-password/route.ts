import { NextRequest, NextResponse } from 'next/server'
import { cookies } from 'next/headers'

export async function POST(req: NextRequest) {
  const cookieStore = await cookies()
  const token = cookieStore.get('primr_session')?.value

  if (!token) {
    return NextResponse.json({ error: 'Not authenticated.' }, { status: 401 })
  }

  const { currentPassword, newPassword } = await req.json()

  const authUrl = process.env.PRIMR_AUTH_URL ?? 'http://localhost:3001'
  const res = await fetch(`${authUrl}/api/auth/change-password`, {
    method: 'POST',
    headers: {
      'Content-Type': 'application/json',
      Authorization: `Bearer ${token}`,
    },
    body: JSON.stringify({ currentPassword, newPassword }),
  })

  const data = await res.json()
  return NextResponse.json(data, { status: res.status })
}

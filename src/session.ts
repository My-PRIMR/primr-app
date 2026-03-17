import { SignJWT, jwtVerify } from 'jose'
import { cookies } from 'next/headers'

const COOKIE_NAME = 'primr_session'
const EXPIRES_IN = 60 * 60 * 24 * 30 // 30 days

function getSecret() {
  return new TextEncoder().encode(process.env.AUTH_SECRET!)
}

export interface PrimrSession {
  user: {
    id: string
    email: string
    name: string | null
    role: string
  }
}

export async function issueSession(payload: { id: string; email: string; name: string | null; role: string }) {
  const token = await new SignJWT({ email: payload.email, name: payload.name, role: payload.role })
    .setProtectedHeader({ alg: 'HS256' })
    .setSubject(payload.id)
    .setIssuedAt()
    .setExpirationTime(`${EXPIRES_IN}s`)
    .sign(getSecret())
  const cookieStore = await cookies()
  cookieStore.set(COOKIE_NAME, token, {
    httpOnly: true,
    sameSite: 'lax',
    path: '/',
    maxAge: EXPIRES_IN,
    secure: process.env.NODE_ENV === 'production',
  })
}

export async function getSession(): Promise<PrimrSession | null> {
  const cookieStore = await cookies()
  const token = cookieStore.get(COOKIE_NAME)?.value
  if (!token) return null
  try {
    const { payload } = await jwtVerify(token, getSecret())
    return {
      user: {
        id: payload.sub as string,
        email: payload.email as string,
        name: (payload.name as string | null) ?? null,
        role: payload.role as string,
      },
    }
  } catch {
    return null
  }
}

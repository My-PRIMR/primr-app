import { SignJWT, jwtVerify } from 'jose'
import { cookies } from 'next/headers'

const COOKIE_NAME = 'primr_session'
const EXPIRES_IN = 60 * 60 * 24 * 30 // 30 days

function getSecret() {
  return new TextEncoder().encode(process.env.AUTH_SECRET!)
}

export interface PrimrSession {
  user: {
    id:           string
    email:        string
    name:         string | null
    productRole:  string
    plan:         string
    internalRole: string | null
  }
}

export async function issueSession(payload: {
  id:           string
  email:        string
  name:         string | null
  productRole:  string
  plan:         string
  internalRole: string | null
}) {
  const token = await new SignJWT({
    email:        payload.email,
    name:         payload.name,
    productRole:  payload.productRole,
    plan:         payload.plan,
    internalRole: payload.internalRole,
  })
    .setProtectedHeader({ alg: 'HS256' })
    .setSubject(payload.id)
    .setIssuedAt()
    .setExpirationTime(`${EXPIRES_IN}s`)
    .sign(getSecret())
  const cookieStore = await cookies()
  const domain = process.env.COOKIE_DOMAIN
  cookieStore.set(COOKIE_NAME, token, {
    httpOnly: true,
    sameSite: 'lax',
    path: '/',
    maxAge: EXPIRES_IN,
    secure: process.env.NODE_ENV === 'production',
    ...(domain ? { domain } : {}),
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
        id:           payload.sub as string,
        email:        payload.email as string,
        name:         (payload.name as string | null) ?? null,
        productRole:  (payload.productRole as string) ?? 'learner',
        plan:         (payload.plan as string) ?? 'free',
        internalRole: (payload.internalRole as string | null) ?? null,
      },
    }
  } catch {
    return null
  }
}

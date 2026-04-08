import { NextRequest, NextResponse } from 'next/server'
import { resolveSegment, triggerOnboardingInvites, resetOnboardingDismiss } from '@/lib/onboarding'

export async function POST(req: NextRequest) {
  const secret = req.headers.get('x-internal-secret')
  if (!secret || secret !== process.env.INTERNAL_SECRET) {
    return NextResponse.json({ error: 'Forbidden' }, { status: 403 })
  }

  const body = await req.json()
  const { userId, email, role, plan } = body as {
    userId: string
    email: string
    role: string
    plan: string
  }

  if (!userId || !email || !role || !plan) {
    return NextResponse.json({ error: 'Missing required fields' }, { status: 400 })
  }

  const segment = resolveSegment(role, plan)
  if (!segment) {
    return NextResponse.json({ invited: 0 })
  }

  // Reset dismiss state so the strip reappears when segment changes (e.g. plan upgrade)
  await resetOnboardingDismiss(userId)
  const invited = await triggerOnboardingInvites(userId, email, segment)
  return NextResponse.json({ invited })
}

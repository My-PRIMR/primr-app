import { NextResponse } from 'next/server'
import { sendEmail } from '@/lib/email'

const EMAIL_RE = /^[^\s@]+@[^\s@]+\.[^\s@]+$/

export async function POST(req: Request) {
  const body = (await req.json()) as {
    name?: string
    email?: string
    teamSize?: string
    message?: string
  }

  if (!body.email || !EMAIL_RE.test(body.email)) {
    return NextResponse.json({ error: 'Invalid email' }, { status: 400 })
  }

  const to = process.env.PRIMR_SALES_EMAIL
  if (!to) {
    return NextResponse.json(
      { error: 'Contact sales is not configured' },
      { status: 500 },
    )
  }

  const subject = `[Enterprise inquiry] ${body.name ?? body.email}`
  const html = `
    <h2>New Enterprise inquiry</h2>
    <p><strong>Name:</strong> ${escapeHtml(body.name ?? '')}</p>
    <p><strong>Email:</strong> ${escapeHtml(body.email)}</p>
    <p><strong>Team size:</strong> ${escapeHtml(body.teamSize ?? '')}</p>
    <p><strong>Message:</strong></p>
    <p>${escapeHtml(body.message ?? '')}</p>
  `

  const result = await sendEmail({
    to,
    subject,
    html,
    replyTo: body.email,
  })

  if (!result.ok) {
    return NextResponse.json(
      { error: 'Failed to send message', detail: result.error ?? result.reason },
      { status: 500 },
    )
  }

  return NextResponse.json({ ok: true })
}

function escapeHtml(s: string): string {
  return s
    .replace(/&/g, '&amp;')
    .replace(/</g, '&lt;')
    .replace(/>/g, '&gt;')
    .replace(/"/g, '&quot;')
    .replace(/'/g, '&#039;')
}

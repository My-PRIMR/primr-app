type SendEmailInput = {
  to: string | string[]
  subject: string
  html: string
  text?: string
  replyTo?: string
}

type SendEmailResult = {
  ok: boolean
  skipped?: boolean
  reason?: string
  provider?: string
  id?: string
  error?: string
}

function getRequiredEnv(name: string): string | null {
  const value = process.env[name]?.trim()
  return value ? value : null
}

function getEmailConfig() {
  const provider = (process.env.EMAIL_PROVIDER ?? 'resend').trim().toLowerCase()
  const from = getRequiredEnv('EMAIL_FROM')
  const resendApiKey = getRequiredEnv('RESEND_API_KEY')
  const enabled = (process.env.EMAIL_ENABLED ?? 'true').trim().toLowerCase() !== 'false'

  return { provider, from, resendApiKey, enabled }
}

export async function sendEmail(input: SendEmailInput): Promise<SendEmailResult> {
  const { provider, from, resendApiKey, enabled } = getEmailConfig()
  const to = Array.isArray(input.to) ? input.to : [input.to]

  if (!enabled) {
    return { ok: false, skipped: true, reason: 'EMAIL_ENABLED=false' }
  }

  if (provider !== 'resend') {
    return { ok: false, skipped: true, reason: `unsupported provider: ${provider}` }
  }

  if (!from) {
    return { ok: false, skipped: true, reason: 'missing EMAIL_FROM' }
  }

  if (!resendApiKey) {
    return { ok: false, skipped: true, reason: 'missing RESEND_API_KEY' }
  }

  const response = await fetch('https://api.resend.com/emails', {
    method: 'POST',
    headers: {
      Authorization: `Bearer ${resendApiKey}`,
      'Content-Type': 'application/json',
    },
    body: JSON.stringify({
      from,
      to,
      subject: input.subject,
      html: input.html,
      text: input.text,
      reply_to: input.replyTo ?? process.env.EMAIL_REPLY_TO ?? undefined,
    }),
  })

  if (!response.ok) {
    const body = await response.text()
    return {
      ok: false,
      provider,
      error: `Resend API error ${response.status}: ${body}`,
    }
  }

  const data = (await response.json()) as { id?: string }
  return { ok: true, provider, id: data.id }
}

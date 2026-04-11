import { POST } from './route'

jest.mock('@/lib/email', () => ({
  sendEmail: jest.fn().mockResolvedValue({ ok: true, id: 'em_1', provider: 'resend' }),
}))

const { sendEmail } = require('@/lib/email')

function req(body: object) {
  return new Request('http://localhost/api/upgrade/contact-sales', {
    method: 'POST',
    body: JSON.stringify(body),
    headers: { 'content-type': 'application/json' },
  })
}

describe('POST /api/upgrade/contact-sales', () => {
  beforeEach(() => {
    jest.clearAllMocks()
    process.env.PRIMR_SALES_EMAIL = 'sales@primr.local'
  })

  it('400 when email missing', async () => {
    const res = await POST(req({ name: 'A' }))
    expect(res.status).toBe(400)
  })

  it('400 when email invalid', async () => {
    const res = await POST(req({ name: 'A', email: 'not-an-email' }))
    expect(res.status).toBe(400)
  })

  it('sends an email to PRIMR_SALES_EMAIL and returns 200', async () => {
    const res = await POST(
      req({
        name: 'Alice',
        email: 'alice@example.com',
        teamSize: '10-50',
        message: 'interested',
      }),
    )
    expect(res.status).toBe(200)
    expect(sendEmail).toHaveBeenCalledWith(
      expect.objectContaining({
        to: 'sales@primr.local',
      }),
    )
  })

  it('500 when PRIMR_SALES_EMAIL is not set', async () => {
    delete process.env.PRIMR_SALES_EMAIL
    const res = await POST(
      req({
        name: 'Alice',
        email: 'alice@example.com',
      }),
    )
    expect(res.status).toBe(500)
  })

  it('500 when sendEmail returns not ok', async () => {
    sendEmail.mockResolvedValue({ ok: false, error: 'provider error' })
    const res = await POST(
      req({
        name: 'Alice',
        email: 'alice@example.com',
      }),
    )
    expect(res.status).toBe(500)
  })
})

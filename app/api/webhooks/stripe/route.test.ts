import { POST } from './route'

jest.mock('@/stripe', () => ({
  getStripe: jest.fn(),
  getStripeWebhookSecret: jest.fn(() => 'whsec_test'),
}))

jest.mock('@/db', () => ({
  db: {
    update: jest.fn(() => ({ set: jest.fn(() => ({ where: jest.fn() })) })),
  },
}))

const { getStripe } = require('@/stripe')

function makeRequest(rawBody: string, signature = 'sig_test'): Request {
  return new Request('http://localhost/api/webhooks/stripe', {
    method: 'POST',
    headers: { 'stripe-signature': signature },
    body: rawBody,
  })
}

describe('POST /api/webhooks/stripe', () => {
  beforeEach(() => jest.clearAllMocks())

  it('returns 400 when signature header is missing', async () => {
    const req = new Request('http://localhost/api/webhooks/stripe', {
      method: 'POST',
      body: '{}',
    })
    const res = await POST(req)
    expect(res.status).toBe(400)
  })

  it('returns 400 when signature verification fails', async () => {
    getStripe.mockReturnValue({
      webhooks: {
        constructEvent: jest.fn(() => {
          throw new Error('bad signature')
        }),
      },
    })
    const res = await POST(makeRequest('{}'))
    expect(res.status).toBe(400)
  })

  it('handles account.updated by marking onboarding complete', async () => {
    const constructEvent = jest.fn().mockReturnValue({
      type: 'account.updated',
      data: {
        object: {
          id: 'acct_123',
          charges_enabled: true,
          details_submitted: true,
        },
      },
    })
    getStripe.mockReturnValue({ webhooks: { constructEvent } })

    const res = await POST(makeRequest('{}'))
    expect(res.status).toBe(200)
    expect(constructEvent).toHaveBeenCalled()
  })
})

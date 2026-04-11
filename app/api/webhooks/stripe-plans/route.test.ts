import { POST } from './route'

jest.mock('@/stripe', () => ({
  getStripe: jest.fn(),
  getStripeWebhookSecret: jest.fn(() => 'whsec_test'),
}))
jest.mock('@/db', () => ({
  db: {
    insert: jest.fn(() => ({ values: jest.fn().mockResolvedValue(undefined) })),
    update: jest.fn(() => ({
      set: jest.fn(() => ({ where: jest.fn().mockResolvedValue(undefined) })),
    })),
    query: {
      planSubscriptions: { findFirst: jest.fn() },
    },
  },
}))

const { getStripe } = require('@/stripe')

function makeRequest(rawBody: string, signature = 'sig_test'): Request {
  return new Request('http://localhost/api/webhooks/stripe-plans', {
    method: 'POST',
    headers: { 'stripe-signature': signature },
    body: rawBody,
  })
}

describe('POST /api/webhooks/stripe-plans', () => {
  beforeEach(() => jest.clearAllMocks())

  it('400 when signature header missing', async () => {
    const req = new Request('http://localhost/api/webhooks/stripe-plans', {
      method: 'POST',
      body: '{}',
    })
    const res = await POST(req)
    expect(res.status).toBe(400)
  })

  it('400 when signature invalid', async () => {
    getStripe.mockReturnValue({
      webhooks: {
        constructEvent: jest.fn(() => {
          throw new Error('bad sig')
        }),
      },
    })
    const res = await POST(makeRequest('{}'))
    expect(res.status).toBe(400)
  })

  it('handles checkout.session.completed and inserts plan subscription', async () => {
    const { db } = require('@/db') as any
    const retrieveSubscription = jest.fn().mockResolvedValue({
      id: 'sub_123',
      status: 'active',
      current_period_end: Math.floor(Date.now() / 1000) + 3600,
      cancel_at_period_end: false,
      items: {
        data: [
          { price: { id: 'price_pm' } },
        ],
      },
    })
    getStripe.mockReturnValue({
      webhooks: {
        constructEvent: jest.fn().mockReturnValue({
          type: 'checkout.session.completed',
          data: {
            object: {
              mode: 'subscription',
              customer: 'cus_1',
              subscription: 'sub_123',
              metadata: {
                primrKind: 'plan_subscription',
                primrUserId: 'u1',
                primrTier: 'pro',
                primrPeriod: 'monthly',
              },
            },
          },
        }),
      },
      subscriptions: { retrieve: retrieveSubscription },
    })

    const res = await POST(makeRequest('{}'))
    expect(res.status).toBe(200)
    expect(db.insert).toHaveBeenCalled()
    expect(db.update).toHaveBeenCalled()
  })

  it('ignores events that are not plan_subscription kind', async () => {
    const { db } = require('@/db') as any
    getStripe.mockReturnValue({
      webhooks: {
        constructEvent: jest.fn().mockReturnValue({
          type: 'checkout.session.completed',
          data: {
            object: {
              mode: 'payment',
              metadata: { primrKind: 'something_else' },
            },
          },
        }),
      },
    })
    const res = await POST(makeRequest('{}'))
    expect(res.status).toBe(200)
    expect(db.insert).not.toHaveBeenCalled()
  })
})

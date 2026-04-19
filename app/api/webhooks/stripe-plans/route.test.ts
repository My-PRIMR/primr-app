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

  it('records trialEndsAt on checkout.session.completed when subscription is trialing', async () => {
    const { db } = require('@/db') as any
    const values = jest.fn().mockResolvedValue(undefined)
    db.insert = jest.fn(() => ({ values }))
    db.update = jest.fn(() => ({
      set: jest.fn(() => ({ where: jest.fn().mockResolvedValue(undefined) })),
    }))

    const trialEndUnix = Math.floor(Date.now() / 1000) + 14 * 86400
    const retrieveSubscription = jest.fn().mockResolvedValue({
      id: 'sub_trial',
      status: 'trialing',
      current_period_end: trialEndUnix,
      trial_end: trialEndUnix,
      cancel_at_period_end: false,
      items: { data: [{ price: { id: 'price_pm' } }] },
    })
    getStripe.mockReturnValue({
      webhooks: {
        constructEvent: jest.fn().mockReturnValue({
          type: 'checkout.session.completed',
          data: {
            object: {
              mode: 'subscription',
              customer: 'cus_1',
              subscription: 'sub_trial',
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
    expect(values).toHaveBeenCalledWith(
      expect.objectContaining({
        trialEndsAt: new Date(trialEndUnix * 1000),
      }),
    )
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

describe('subscription lifecycle', () => {
  beforeEach(() => jest.clearAllMocks())

  it('updates on customer.subscription.updated', async () => {
    const { db } = require('@/db') as any
    const where = jest.fn().mockResolvedValue(undefined)
    const set = jest.fn(() => ({ where }))
    db.update = jest.fn(() => ({ set }))
    db.query.planSubscriptions.findFirst = jest.fn().mockResolvedValue({
      id: 'row_1',
      subscriberUserId: 'u1',
    })

    getStripe.mockReturnValue({
      webhooks: {
        constructEvent: jest.fn().mockReturnValue({
          type: 'customer.subscription.updated',
          data: {
            object: {
              id: 'sub_123',
              status: 'active',
              current_period_end: Math.floor(Date.now() / 1000) + 3600,
              cancel_at_period_end: true,
              metadata: { primrKind: 'plan_subscription' },
              items: { data: [{ price: { id: 'price_pm' } }] },
            },
          },
        }),
      },
    })
    const res = await POST(makeRequest('{}'))
    expect(res.status).toBe(200)
    expect(set).toHaveBeenCalledWith(
      expect.objectContaining({ cancelAtPeriodEnd: true, trialEndsAt: null }),
    )
  })

  it('preserves trialEndsAt on customer.subscription.updated while still trialing', async () => {
    const { db } = require('@/db') as any
    const where = jest.fn().mockResolvedValue(undefined)
    const set = jest.fn(() => ({ where }))
    db.update = jest.fn(() => ({ set }))
    db.query.planSubscriptions.findFirst = jest.fn().mockResolvedValue({
      id: 'row_1',
      subscriberUserId: 'u1',
    })

    const trialEndUnix = Math.floor(Date.now() / 1000) + 10 * 86400
    getStripe.mockReturnValue({
      webhooks: {
        constructEvent: jest.fn().mockReturnValue({
          type: 'customer.subscription.updated',
          data: {
            object: {
              id: 'sub_trial',
              status: 'trialing',
              current_period_end: trialEndUnix,
              trial_end: trialEndUnix,
              cancel_at_period_end: false,
              metadata: { primrKind: 'plan_subscription' },
              items: { data: [{ price: { id: 'price_pm' } }] },
            },
          },
        }),
      },
    })
    const res = await POST(makeRequest('{}'))
    expect(res.status).toBe(200)
    expect(set).toHaveBeenCalledWith(
      expect.objectContaining({
        trialEndsAt: new Date(trialEndUnix * 1000),
      }),
    )
  })

  it('downgrades user on customer.subscription.deleted', async () => {
    const { db } = require('@/db') as any
    const where = jest.fn().mockResolvedValue(undefined)
    const set = jest.fn(() => ({ where }))
    db.update = jest.fn(() => ({ set }))
    db.query.planSubscriptions.findFirst = jest.fn().mockResolvedValue({
      id: 'row_1',
      subscriberUserId: 'u1',
      organizationId: null,
    })

    getStripe.mockReturnValue({
      webhooks: {
        constructEvent: jest.fn().mockReturnValue({
          type: 'customer.subscription.deleted',
          data: {
            object: {
              id: 'sub_123',
              metadata: { primrKind: 'plan_subscription' },
            },
          },
        }),
      },
    })
    const res = await POST(makeRequest('{}'))
    expect(res.status).toBe(200)
    expect(set).toHaveBeenCalled()
  })

  it('marks past_due on invoice.payment_failed', async () => {
    const { db } = require('@/db') as any
    const where = jest.fn().mockResolvedValue(undefined)
    const set = jest.fn(() => ({ where }))
    db.update = jest.fn(() => ({ set }))
    db.query.planSubscriptions.findFirst = jest.fn().mockResolvedValue({
      id: 'row_1',
      stripeSubscriptionId: 'sub_123',
    })

    getStripe.mockReturnValue({
      webhooks: {
        constructEvent: jest.fn().mockReturnValue({
          type: 'invoice.payment_failed',
          data: {
            object: {
              id: 'in_123',
              subscription: 'sub_123',
              metadata: { primrKind: 'plan_subscription' },
            },
          },
        }),
      },
    })
    const res = await POST(makeRequest('{}'))
    expect(res.status).toBe(200)
    expect(set).toHaveBeenCalledWith(
      expect.objectContaining({ status: 'past_due' }),
    )
  })

  it('ignores invoice.payment_failed when no plan_subscription row exists', async () => {
    const { db } = require('@/db') as any
    const where = jest.fn().mockResolvedValue(undefined)
    const set = jest.fn(() => ({ where }))
    db.update = jest.fn(() => ({ set }))
    db.query.planSubscriptions.findFirst = jest.fn().mockResolvedValue(null)

    getStripe.mockReturnValue({
      webhooks: {
        constructEvent: jest.fn().mockReturnValue({
          type: 'invoice.payment_failed',
          data: {
            object: {
              id: 'in_other',
              subscription: 'sub_other',
            },
          },
        }),
      },
    })
    const res = await POST(makeRequest('{}'))
    expect(res.status).toBe(200)
    expect(set).not.toHaveBeenCalled()
  })
})

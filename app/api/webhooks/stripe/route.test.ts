import { POST } from './route'
import * as stripeModule from '@/stripe'
import * as dbModule from '@/db'

jest.mock('@/stripe', () => ({
  getStripe: jest.fn(),
  getCreatorWebhookSecret: jest.fn(() => 'whsec_test'),
}))

jest.mock('@/db', () => ({
  db: {
    update: jest.fn(() => ({ set: jest.fn(() => ({ where: jest.fn() })) })),
    insert: jest.fn(() => ({ values: jest.fn() })),
    query: {
      creatorProfiles: {
        findFirst: jest.fn(),
      },
    },
  },
}))

// Cast through `unknown` so tests can return partial mocks without satisfying
// the full Stripe SDK / Drizzle shapes.
const getStripe = stripeModule.getStripe as unknown as jest.Mock
const db = dbModule.db as unknown as {
  update: jest.Mock
  insert: jest.Mock
  query: {
    creatorProfiles: {
      findFirst: jest.Mock
    }
  }
}

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

describe('POST /api/webhooks/stripe — checkout.session.completed', () => {
  beforeEach(() => jest.clearAllMocks())

  it('inserts a purchase row and increments creator lifetime revenue', async () => {
    // Mock the creator profile lookup
    db.query = {
      ...db.query,
      creatorProfiles: {
        findFirst: jest.fn().mockResolvedValue({
          userId: 'creator',
          lifetimeRevenueCents: 0,
          revenueThresholdCents: 100000,
        }),
      },
    }

    const insertValues = jest.fn().mockResolvedValue(undefined)
    db.insert = jest.fn(() => ({ values: insertValues }))
    const updateWhere = jest.fn().mockResolvedValue(undefined)
    db.update = jest.fn(() => ({
      set: jest.fn(() => ({ where: updateWhere })),
    }))

    getStripe.mockReturnValue({
      webhooks: {
        constructEvent: jest.fn().mockReturnValue({
          type: 'checkout.session.completed',
          data: {
            object: {
              mode: 'payment',
              payment_intent: 'pi_123',
              amount_total: 1000,
              metadata: {
                primrBuyerId: 'buyer',
                primrCreatorId: 'creator',
                primrKind: 'lesson',
                primrLessonId: 'L1',
                primrCourseId: '',
              },
            },
          },
        }),
      },
    })

    const res = await POST(makeRequest('{}'))
    expect(res.status).toBe(200)
    expect(insertValues).toHaveBeenCalled()
    expect(updateWhere).toHaveBeenCalled()
  })

  it('is idempotent — swallows unique violation on duplicate payment_intent', async () => {
    db.query = {
      ...db.query,
      creatorProfiles: {
        findFirst: jest.fn().mockResolvedValue({
          userId: 'creator',
          lifetimeRevenueCents: 0,
          revenueThresholdCents: 100000,
        }),
      },
    }

    const uniqueError = Object.assign(new Error('duplicate key'), {
      code: '23505',
    })
    const insertValues = jest.fn().mockRejectedValue(uniqueError)
    db.insert = jest.fn(() => ({ values: insertValues }))
    db.update = jest.fn(() => ({
      set: jest.fn(() => ({ where: jest.fn() })),
    }))

    getStripe.mockReturnValue({
      webhooks: {
        constructEvent: jest.fn().mockReturnValue({
          type: 'checkout.session.completed',
          data: {
            object: {
              mode: 'payment',
              payment_intent: 'pi_123',
              amount_total: 1000,
              metadata: {
                primrBuyerId: 'buyer',
                primrCreatorId: 'creator',
                primrKind: 'lesson',
                primrLessonId: 'L1',
                primrCourseId: '',
              },
            },
          },
        }),
      },
    })

    const res = await POST(makeRequest('{}'))
    expect(res.status).toBe(200) // 200, not 500
  })
})

describe('POST /api/webhooks/stripe — subscription events', () => {
  beforeEach(() => jest.clearAllMocks())

  it('upserts a subscription row on customer.subscription.created', async () => {
    const { db } = require('@/db') as any

    // Reset db.insert to a chainable mock that supports onConflictDoUpdate
    const onConflictDoUpdate = jest.fn().mockResolvedValue(undefined)
    const values = jest.fn(() => ({ onConflictDoUpdate }))
    db.insert = jest.fn(() => ({ values }))

    getStripe.mockReturnValue({
      webhooks: {
        constructEvent: jest.fn().mockReturnValue({
          type: 'customer.subscription.created',
          data: {
            object: {
              id: 'sub_123',
              status: 'active',
              current_period_end: Math.floor(Date.now() / 1000) + 3600,
              metadata: {
                primrSubscriberId: 'buyer',
                primrCreatorId: 'creator',
              },
            },
          },
        }),
      },
    })

    const res = await POST(makeRequest('{}'))
    expect(res.status).toBe(200)
    expect(values).toHaveBeenCalled()
    expect(onConflictDoUpdate).toHaveBeenCalled()
  })

  it('marks subscription canceled on customer.subscription.deleted', async () => {
    const { db } = require('@/db') as any
    const updateWhere = jest.fn().mockResolvedValue(undefined)
    db.update = jest.fn(() => ({
      set: jest.fn(() => ({ where: updateWhere })),
    }))

    getStripe.mockReturnValue({
      webhooks: {
        constructEvent: jest.fn().mockReturnValue({
          type: 'customer.subscription.deleted',
          data: { object: { id: 'sub_123' } },
        }),
      },
    })

    const res = await POST(makeRequest('{}'))
    expect(res.status).toBe(200)
    expect(updateWhere).toHaveBeenCalled()
  })

  it('marks subscription past_due on invoice.payment_failed', async () => {
    const { db } = require('@/db') as any
    const updateWhere = jest.fn().mockResolvedValue(undefined)
    db.update = jest.fn(() => ({
      set: jest.fn(() => ({ where: updateWhere })),
    }))

    getStripe.mockReturnValue({
      webhooks: {
        constructEvent: jest.fn().mockReturnValue({
          type: 'invoice.payment_failed',
          data: {
            object: {
              id: 'in_123',
              subscription: 'sub_123',
            },
          },
        }),
      },
    })

    const res = await POST(makeRequest('{}'))
    expect(res.status).toBe(200)
    expect(updateWhere).toHaveBeenCalled()
  })
})

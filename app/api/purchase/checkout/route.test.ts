import { POST } from './route'

jest.mock('@/session', () => ({ getSession: jest.fn() }))
jest.mock('@/stripe', () => ({ getStripe: jest.fn() }))
jest.mock('@/db', () => ({
  db: {
    query: {
      lessons: { findFirst: jest.fn() },
      courses: { findFirst: jest.fn() },
      creatorProfiles: { findFirst: jest.fn() },
    },
  },
}))

const { getSession } = require('@/session')
const { getStripe } = require('@/stripe')
const { db } = require('@/db')

function req(body: object) {
  return new Request('http://localhost/api/purchase/checkout', {
    method: 'POST',
    body: JSON.stringify(body),
    headers: { 'content-type': 'application/json' },
  })
}

describe('POST /api/purchase/checkout', () => {
  beforeEach(() => jest.clearAllMocks())

  it('401 when not authed', async () => {
    getSession.mockResolvedValue(null)
    const res = await POST(req({ lessonId: 'L1' }))
    expect(res.status).toBe(401)
  })

  it('400 when neither lessonId nor courseId provided', async () => {
    getSession.mockResolvedValue({ user: { id: 'u1' } })
    const res = await POST(req({}))
    expect(res.status).toBe(400)
  })

  it('creates a Checkout Session with application_fee_amount based on creator tier', async () => {
    getSession.mockResolvedValue({ user: { id: 'buyer' } })
    db.query.lessons.findFirst.mockResolvedValue({
      id: 'L1',
      title: 'Intro',
      isPaid: true,
      priceCents: 1000,
      createdBy: 'creator',
    })
    db.query.creatorProfiles.findFirst.mockResolvedValue({
      userId: 'creator',
      stripeAccountId: 'acct_c',
      stripeOnboardingComplete: true,
      lifetimeRevenueCents: 0,
      revenueThresholdCents: 100000,
    })
    const create = jest
      .fn()
      .mockResolvedValue({ url: 'https://checkout.stripe.com/abc' })
    getStripe.mockReturnValue({ checkout: { sessions: { create } } })

    const res = await POST(req({ lessonId: 'L1' }))
    expect(res.status).toBe(200)
    expect(create).toHaveBeenCalledWith(
      expect.objectContaining({
        mode: 'payment',
        payment_intent_data: expect.objectContaining({
          application_fee_amount: 300,
          transfer_data: { destination: 'acct_c' },
        }),
      }),
    )
    const body = await res.json()
    expect(body.url).toBe('https://checkout.stripe.com/abc')
  })

  it('400 when lesson is not paid', async () => {
    getSession.mockResolvedValue({ user: { id: 'buyer' } })
    db.query.lessons.findFirst.mockResolvedValue({
      id: 'L1',
      isPaid: false,
      priceCents: null,
      createdBy: 'creator',
    })
    const res = await POST(req({ lessonId: 'L1' }))
    expect(res.status).toBe(400)
  })

  it('400 when creator has not completed Stripe onboarding', async () => {
    getSession.mockResolvedValue({ user: { id: 'buyer' } })
    db.query.lessons.findFirst.mockResolvedValue({
      id: 'L1',
      isPaid: true,
      priceCents: 1000,
      createdBy: 'creator',
    })
    db.query.creatorProfiles.findFirst.mockResolvedValue({
      stripeAccountId: 'acct_c',
      stripeOnboardingComplete: false,
      lifetimeRevenueCents: 0,
      revenueThresholdCents: 100000,
    })
    const res = await POST(req({ lessonId: 'L1' }))
    expect(res.status).toBe(400)
  })
})

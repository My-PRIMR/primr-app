import { POST } from './route'

jest.mock('@/session', () => ({ getSession: jest.fn() }))
jest.mock('@/stripe', () => ({ getStripe: jest.fn() }))
jest.mock('@/db', () => ({
  db: { query: { creatorProfiles: { findFirst: jest.fn() } } },
}))

const { getSession } = require('@/session')
const { getStripe } = require('@/stripe')
const { db } = require('@/db')

function req(body: object) {
  return new Request('http://localhost/api/subscribe/checkout', {
    method: 'POST',
    body: JSON.stringify(body),
    headers: { 'content-type': 'application/json' },
  })
}

describe('POST /api/subscribe/checkout', () => {
  beforeEach(() => jest.clearAllMocks())

  it('401 when not authed', async () => {
    getSession.mockResolvedValue(null)
    const res = await POST(req({ creatorId: 'c1' }))
    expect(res.status).toBe(401)
  })

  it('400 when creatorId missing', async () => {
    getSession.mockResolvedValue({ user: { id: 'u1' } })
    const res = await POST(req({}))
    expect(res.status).toBe(400)
  })

  it('400 when creator has not enabled subscriptions', async () => {
    getSession.mockResolvedValue({ user: { id: 'u1' } })
    db.query.creatorProfiles.findFirst.mockResolvedValue({
      userId: 'c1',
      stripeAccountId: 'acct_c',
      stripeOnboardingComplete: true,
      subscriptionEnabled: false,
      subscriptionPriceCents: null,
    })
    const res = await POST(req({ creatorId: 'c1' }))
    expect(res.status).toBe(400)
  })

  it('creates a subscription-mode Checkout Session with application_fee_percent', async () => {
    getSession.mockResolvedValue({ user: { id: 'u1' } })
    db.query.creatorProfiles.findFirst.mockResolvedValue({
      userId: 'c1',
      stripeAccountId: 'acct_c',
      stripeOnboardingComplete: true,
      subscriptionEnabled: true,
      subscriptionPriceCents: 500,
      lifetimeRevenueCents: 0,
      revenueThresholdCents: 100000,
    })
    const create = jest
      .fn()
      .mockResolvedValue({ url: 'https://checkout.stripe.com/sub' })
    getStripe.mockReturnValue({ checkout: { sessions: { create } } })

    const res = await POST(req({ creatorId: 'c1' }))
    expect(res.status).toBe(200)
    expect(create).toHaveBeenCalledWith(
      expect.objectContaining({
        mode: 'subscription',
        subscription_data: expect.objectContaining({
          application_fee_percent: 30,
          transfer_data: { destination: 'acct_c' },
        }),
      }),
    )
    const body = await res.json()
    expect(body.url).toBe('https://checkout.stripe.com/sub')
  })

  it('uses 20% application_fee_percent when creator is past the threshold', async () => {
    getSession.mockResolvedValue({ user: { id: 'u1' } })
    db.query.creatorProfiles.findFirst.mockResolvedValue({
      userId: 'c1',
      stripeAccountId: 'acct_c',
      stripeOnboardingComplete: true,
      subscriptionEnabled: true,
      subscriptionPriceCents: 500,
      lifetimeRevenueCents: 150000,
      revenueThresholdCents: 100000,
    })
    const create = jest
      .fn()
      .mockResolvedValue({ url: 'https://checkout.stripe.com/sub2' })
    getStripe.mockReturnValue({ checkout: { sessions: { create } } })

    const res = await POST(req({ creatorId: 'c1' }))
    expect(res.status).toBe(200)
    expect(create).toHaveBeenCalledWith(
      expect.objectContaining({
        subscription_data: expect.objectContaining({
          application_fee_percent: 20,
        }),
      }),
    )
  })
})

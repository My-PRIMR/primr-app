import { POST } from './route'

jest.mock('@/session', () => ({ getSession: jest.fn() }))
jest.mock('@/stripe', () => ({ getStripe: jest.fn() }))
jest.mock('@/plans', () => ({
  getPriceId: jest.fn(),
}))
jest.mock('@/lib/billing', () => ({
  ensureStripeCustomer: jest.fn(),
}))

const { getSession } = require('@/session')
const { getStripe } = require('@/stripe')
const { getPriceId } = require('@/plans')
const { ensureStripeCustomer } = require('@/lib/billing')

function req(body: object) {
  return new Request('http://localhost/api/upgrade/checkout', {
    method: 'POST',
    body: JSON.stringify(body),
    headers: { 'content-type': 'application/json' },
  })
}

describe('POST /api/upgrade/checkout', () => {
  beforeEach(() => jest.clearAllMocks())

  it('401 when not authed', async () => {
    getSession.mockResolvedValue(null)
    const res = await POST(req({ tier: 'pro', period: 'monthly' }))
    expect(res.status).toBe(401)
  })

  it('400 on invalid tier', async () => {
    getSession.mockResolvedValue({ user: { id: 'u1', email: 'a@b.c', name: 'A' } })
    const res = await POST(req({ tier: 'bogus', period: 'monthly' }))
    expect(res.status).toBe(400)
  })

  it('400 on invalid period', async () => {
    getSession.mockResolvedValue({ user: { id: 'u1', email: 'a@b.c', name: 'A' } })
    const res = await POST(req({ tier: 'pro', period: 'biannual' }))
    expect(res.status).toBe(400)
  })

  it('creates a subscription-mode Checkout Session for Pro Monthly', async () => {
    getSession.mockResolvedValue({ user: { id: 'u1', email: 'a@b.c', name: 'A' } })
    ensureStripeCustomer.mockResolvedValue('cus_1')
    getPriceId.mockReturnValue('price_pm')
    const create = jest
      .fn()
      .mockResolvedValue({ url: 'https://checkout.stripe.com/abc' })
    getStripe.mockReturnValue({ checkout: { sessions: { create } } })

    const res = await POST(req({ tier: 'pro', period: 'monthly' }))
    expect(res.status).toBe(200)
    expect(create).toHaveBeenCalledWith(
      expect.objectContaining({
        mode: 'subscription',
        customer: 'cus_1',
        line_items: [{ price: 'price_pm', quantity: 1 }],
        metadata: expect.objectContaining({
          primrKind: 'plan_subscription',
          primrUserId: 'u1',
          primrTier: 'pro',
          primrPeriod: 'monthly',
        }),
      }),
    )
    const body = await res.json()
    expect(body.url).toBe('https://checkout.stripe.com/abc')
  })

  it('rejects teams tier in this task (handled in Task 16)', async () => {
    getSession.mockResolvedValue({ user: { id: 'u1', email: 'a@b.c', name: 'A' } })
    const res = await POST(req({ tier: 'teams', period: 'monthly' }))
    expect(res.status).toBe(400)
    const body = await res.json()
    expect(body.error).toMatch(/not.*yet/i)
  })
})

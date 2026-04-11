import { POST } from './route'

jest.mock('@/session', () => ({ getSession: jest.fn() }))
jest.mock('@/stripe', () => ({ getStripe: jest.fn() }))
jest.mock('@/plans', () => ({
  getPriceId: jest.fn(),
}))
jest.mock('@/lib/billing', () => ({
  ensureStripeCustomer: jest.fn(),
}))
jest.mock('@/db', () => ({
  db: {
    query: {
      users: { findFirst: jest.fn() },
      organizations: { findFirst: jest.fn() },
    },
    insert: jest.fn(() => ({
      values: jest.fn(() => ({ returning: jest.fn() })),
    })),
    update: jest.fn(() => ({
      set: jest.fn(() => ({ where: jest.fn().mockResolvedValue(undefined) })),
    })),
  },
}))

const { getSession } = require('@/session')
const { getStripe } = require('@/stripe')
const { getPriceId } = require('@/plans')
const { ensureStripeCustomer } = require('@/lib/billing')
const { db } = require('@/db')

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

  describe('Teams tier', () => {
    beforeEach(() => {
      jest.clearAllMocks()
    })

    it('requires teamName when user has no org', async () => {
      getSession.mockResolvedValue({
        user: { id: 'u1', email: 'a@b.c', name: 'A' },
      })
      db.query.users.findFirst.mockResolvedValue({
        id: 'u1',
        email: 'a@b.c',
        name: 'A',
        organizationId: null,
      })
      const res = await POST(req({ tier: 'teams', period: 'monthly' }))
      expect(res.status).toBe(400)
      const body = await res.json()
      expect(body.error).toMatch(/team name/i)
    })

    it('creates an org and then a Checkout Session when user has no org', async () => {
      getSession.mockResolvedValue({
        user: { id: 'u1', email: 'a@b.c', name: 'A' },
      })
      db.query.users.findFirst.mockResolvedValue({
        id: 'u1',
        email: 'a@b.c',
        name: 'A',
        organizationId: null,
      })
      ensureStripeCustomer.mockResolvedValue('cus_1')
      getPriceId.mockReturnValue('price_tm')

      const returning = jest.fn().mockResolvedValue([{ id: 'org_new' }])
      const values = jest.fn(() => ({ returning }))
      db.insert = jest.fn(() => ({ values }))
      db.update = jest.fn(() => ({
        set: jest.fn(() => ({ where: jest.fn().mockResolvedValue(undefined) })),
      }))

      const create = jest
        .fn()
        .mockResolvedValue({ url: 'https://checkout.stripe.com/teams' })
      getStripe.mockReturnValue({ checkout: { sessions: { create } } })

      const res = await POST(
        req({ tier: 'teams', period: 'monthly', teamName: 'Acme' }),
      )
      expect(res.status).toBe(200)
      expect(values).toHaveBeenCalledWith(
        expect.objectContaining({ name: 'Acme', ownerId: 'u1' }),
      )
      expect(create).toHaveBeenCalledWith(
        expect.objectContaining({
          metadata: expect.objectContaining({
            primrTier: 'teams',
            primrOrganizationId: 'org_new',
          }),
        }),
      )
    })

    it('rejects when existing org already has an active subscription', async () => {
      getSession.mockResolvedValue({
        user: { id: 'u1', email: 'a@b.c', name: 'A' },
      })
      db.query.users.findFirst.mockResolvedValue({
        id: 'u1',
        email: 'a@b.c',
        name: 'A',
        organizationId: 'org_existing',
      })
      db.query.organizations.findFirst.mockResolvedValue({
        id: 'org_existing',
        name: 'Existing',
        planSubscriptionId: 'ps_1',
      })
      const res = await POST(req({ tier: 'teams', period: 'monthly' }))
      expect(res.status).toBe(400)
      const body = await res.json()
      expect(body.error).toMatch(/already.*active/i)
    })

    it('reuses existing org without subscription', async () => {
      getSession.mockResolvedValue({
        user: { id: 'u1', email: 'a@b.c', name: 'A' },
      })
      db.query.users.findFirst.mockResolvedValue({
        id: 'u1',
        email: 'a@b.c',
        name: 'A',
        organizationId: 'org_existing',
      })
      db.query.organizations.findFirst.mockResolvedValue({
        id: 'org_existing',
        name: 'Existing',
        planSubscriptionId: null,
      })
      ensureStripeCustomer.mockResolvedValue('cus_1')
      getPriceId.mockReturnValue('price_tm')

      const create = jest
        .fn()
        .mockResolvedValue({ url: 'https://checkout.stripe.com/teams2' })
      getStripe.mockReturnValue({ checkout: { sessions: { create } } })

      const res = await POST(req({ tier: 'teams', period: 'monthly' }))
      expect(res.status).toBe(200)
      expect(create).toHaveBeenCalledWith(
        expect.objectContaining({
          metadata: expect.objectContaining({
            primrTier: 'teams',
            primrOrganizationId: 'org_existing',
          }),
        }),
      )
    })
  })
})

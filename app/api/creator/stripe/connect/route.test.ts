import { POST } from './route'

jest.mock('@/session', () => ({
  getSession: jest.fn(),
}))

jest.mock('@/stripe', () => ({
  getStripe: jest.fn(),
}))

jest.mock('@/db', () => ({
  db: {
    query: { creatorProfiles: { findFirst: jest.fn() } },
    insert: jest.fn(() => ({ values: jest.fn() })),
    update: jest.fn(() => ({ set: jest.fn(() => ({ where: jest.fn() })) })),
  },
}))

const { getSession } = require('@/session')
const { getStripe } = require('@/stripe')
const { db } = require('@/db')

describe('POST /api/creator/stripe/connect', () => {
  beforeEach(() => {
    jest.clearAllMocks()
    // reset mocks on nested objects
    db.query.creatorProfiles.findFirst.mockReset()
  })

  it('returns 401 when unauthenticated', async () => {
    getSession.mockResolvedValue(null)
    const res = await POST()
    expect(res.status).toBe(401)
  })

  it('creates a Connect account and returns an onboarding URL', async () => {
    getSession.mockResolvedValue({
      user: { id: 'user-1', email: 'creator@example.com' },
    })
    db.query.creatorProfiles.findFirst.mockResolvedValue(null)
    const accountsCreate = jest.fn().mockResolvedValue({ id: 'acct_123' })
    const accountLinksCreate = jest
      .fn()
      .mockResolvedValue({ url: 'https://connect.stripe.com/abc' })
    getStripe.mockReturnValue({
      accounts: { create: accountsCreate },
      accountLinks: { create: accountLinksCreate },
    })

    const res = await POST()
    const body = await res.json()

    expect(accountsCreate).toHaveBeenCalledWith(
      expect.objectContaining({
        type: 'express',
        email: 'creator@example.com',
      }),
    )
    expect(body.url).toBe('https://connect.stripe.com/abc')
  })

  it('reuses existing Connect account on subsequent calls', async () => {
    getSession.mockResolvedValue({
      user: { id: 'user-1', email: 'creator@example.com' },
    })
    db.query.creatorProfiles.findFirst.mockResolvedValue({
      userId: 'user-1',
      stripeAccountId: 'acct_existing',
      stripeOnboardingComplete: false,
    })
    const accountsCreate = jest.fn()
    const accountLinksCreate = jest
      .fn()
      .mockResolvedValue({ url: 'https://connect.stripe.com/existing' })
    getStripe.mockReturnValue({
      accounts: { create: accountsCreate },
      accountLinks: { create: accountLinksCreate },
    })

    const res = await POST()
    expect(accountsCreate).not.toHaveBeenCalled()
    expect(accountLinksCreate).toHaveBeenCalledWith(
      expect.objectContaining({ account: 'acct_existing' }),
    )
    const body = await res.json()
    expect(body.url).toBe('https://connect.stripe.com/existing')
  })
})

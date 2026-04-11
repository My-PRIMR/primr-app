import { POST } from './route'

jest.mock('@/session', () => ({ getSession: jest.fn() }))
jest.mock('@/stripe', () => ({ getStripe: jest.fn() }))
jest.mock('@/db', () => ({
  db: { query: { users: { findFirst: jest.fn() } } },
}))

const { getSession } = require('@/session')
const { getStripe } = require('@/stripe')
const { db } = require('@/db')

describe('POST /api/billing/portal', () => {
  beforeEach(() => jest.clearAllMocks())

  it('401 when not authed', async () => {
    getSession.mockResolvedValue(null)
    const res = await POST()
    expect(res.status).toBe(401)
  })

  it('400 when user has no stripeCustomerId', async () => {
    getSession.mockResolvedValue({ user: { id: 'u1' } })
    db.query.users.findFirst.mockResolvedValue({ id: 'u1', stripeCustomerId: null })
    const res = await POST()
    expect(res.status).toBe(400)
  })

  it('creates a Customer Portal session and returns the URL', async () => {
    getSession.mockResolvedValue({ user: { id: 'u1' } })
    db.query.users.findFirst.mockResolvedValue({
      id: 'u1',
      stripeCustomerId: 'cus_1',
    })
    const create = jest
      .fn()
      .mockResolvedValue({ url: 'https://billing.stripe.com/session' })
    getStripe.mockReturnValue({ billingPortal: { sessions: { create } } })

    const res = await POST()
    expect(res.status).toBe(200)
    expect(create).toHaveBeenCalledWith(
      expect.objectContaining({ customer: 'cus_1' }),
    )
    const body = await res.json()
    expect(body.url).toBe('https://billing.stripe.com/session')
  })
})

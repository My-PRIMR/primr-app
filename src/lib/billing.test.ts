import {
  ensureStripeCustomer,
  downgradeUserToFree,
  downgradeOrganization,
} from './billing'

jest.mock('@/stripe', () => ({ getStripe: jest.fn() }))
jest.mock('@/db', () => ({
  db: {
    query: { users: { findFirst: jest.fn() } },
    update: jest.fn(() => ({
      set: jest.fn(() => ({ where: jest.fn().mockResolvedValue(undefined) })),
    })),
  },
}))

const { getStripe } = require('@/stripe')
const { db } = require('@/db')

describe('ensureStripeCustomer', () => {
  beforeEach(() => jest.clearAllMocks())

  it('returns existing stripeCustomerId if user has one', async () => {
    db.query.users.findFirst.mockResolvedValue({
      id: 'u1',
      stripeCustomerId: 'cus_existing',
      email: 'a@b.c',
      name: 'A',
    })
    const customersCreate = jest.fn()
    getStripe.mockReturnValue({ customers: { create: customersCreate } })

    const id = await ensureStripeCustomer('u1', 'a@b.c', 'A')
    expect(id).toBe('cus_existing')
    expect(customersCreate).not.toHaveBeenCalled()
  })

  it('creates a new customer and caches the id when user has none', async () => {
    db.query.users.findFirst.mockResolvedValue({
      id: 'u1',
      stripeCustomerId: null,
      email: 'a@b.c',
      name: 'A',
    })
    const customersCreate = jest.fn().mockResolvedValue({ id: 'cus_new' })
    getStripe.mockReturnValue({ customers: { create: customersCreate } })

    const id = await ensureStripeCustomer('u1', 'a@b.c', 'A')
    expect(id).toBe('cus_new')
    expect(customersCreate).toHaveBeenCalledWith(
      expect.objectContaining({ email: 'a@b.c', name: 'A' }),
    )
    expect(db.update).toHaveBeenCalled()
  })

  it('handles null name gracefully', async () => {
    db.query.users.findFirst.mockResolvedValue({
      id: 'u1',
      stripeCustomerId: null,
      email: 'a@b.c',
      name: null,
    })
    const customersCreate = jest.fn().mockResolvedValue({ id: 'cus_new' })
    getStripe.mockReturnValue({ customers: { create: customersCreate } })

    const id = await ensureStripeCustomer('u1', 'a@b.c', null)
    expect(id).toBe('cus_new')
    expect(customersCreate).toHaveBeenCalledWith(
      expect.objectContaining({ email: 'a@b.c' }),
    )
  })
})

describe('downgradeUserToFree', () => {
  beforeEach(() => jest.clearAllMocks())

  it('sets user plan to free', async () => {
    const where = jest.fn().mockResolvedValue(undefined)
    const set = jest.fn(() => ({ where }))
    db.update.mockReturnValue({ set })
    await downgradeUserToFree('u1')
    expect(set).toHaveBeenCalledWith(
      expect.objectContaining({ plan: 'free' }),
    )
    expect(where).toHaveBeenCalled()
  })
})

describe('downgradeOrganization', () => {
  beforeEach(() => jest.clearAllMocks())

  it('downgrades all users whose organizationId matches', async () => {
    const where = jest.fn().mockResolvedValue(undefined)
    const set = jest.fn(() => ({ where }))
    db.update.mockReturnValue({ set })
    await downgradeOrganization('org1')
    expect(set).toHaveBeenCalledWith(
      expect.objectContaining({ plan: 'free' }),
    )
    expect(where).toHaveBeenCalled()
  })
})

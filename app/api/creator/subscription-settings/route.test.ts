import { PATCH } from './route'

jest.mock('@/session', () => ({ getSession: jest.fn() }))
jest.mock('@/db', () => ({
  db: {
    query: { creatorProfiles: { findFirst: jest.fn() } },
    update: jest.fn(() => ({
      set: jest.fn(() => ({ where: jest.fn().mockResolvedValue(undefined) })),
    })),
  },
}))

const { getSession } = require('@/session')
const { db } = require('@/db')

function req(body: object) {
  return new Request('http://localhost/api/creator/subscription-settings', {
    method: 'PATCH',
    body: JSON.stringify(body),
    headers: { 'content-type': 'application/json' },
  })
}

describe('PATCH /api/creator/subscription-settings', () => {
  beforeEach(() => jest.clearAllMocks())

  it('401 when not authed', async () => {
    getSession.mockResolvedValue(null)
    const res = await PATCH(req({ enabled: true, priceCents: 500 }))
    expect(res.status).toBe(401)
  })

  it('400 when price is below $1', async () => {
    getSession.mockResolvedValue({ user: { id: 'u1' } })
    db.query.creatorProfiles.findFirst.mockResolvedValue({
      userId: 'u1',
      stripeOnboardingComplete: true,
    })
    const res = await PATCH(req({ enabled: true, priceCents: 50 }))
    expect(res.status).toBe(400)
  })

  it('400 when price is above $100', async () => {
    getSession.mockResolvedValue({ user: { id: 'u1' } })
    db.query.creatorProfiles.findFirst.mockResolvedValue({
      userId: 'u1',
      stripeOnboardingComplete: true,
    })
    const res = await PATCH(req({ enabled: true, priceCents: 20000 }))
    expect(res.status).toBe(400)
  })

  it('400 when onboarding not complete', async () => {
    getSession.mockResolvedValue({ user: { id: 'u1' } })
    db.query.creatorProfiles.findFirst.mockResolvedValue({
      userId: 'u1',
      stripeOnboardingComplete: false,
    })
    const res = await PATCH(req({ enabled: true, priceCents: 500 }))
    expect(res.status).toBe(400)
  })

  it('200 on valid input', async () => {
    getSession.mockResolvedValue({ user: { id: 'u1' } })
    db.query.creatorProfiles.findFirst.mockResolvedValue({
      userId: 'u1',
      stripeOnboardingComplete: true,
    })
    const res = await PATCH(req({ enabled: true, priceCents: 500 }))
    expect(res.status).toBe(200)
  })

  it('200 when disabling subscriptions (enabled=false clears price)', async () => {
    getSession.mockResolvedValue({ user: { id: 'u1' } })
    db.query.creatorProfiles.findFirst.mockResolvedValue({
      userId: 'u1',
      stripeOnboardingComplete: true,
    })
    const res = await PATCH(req({ enabled: false, priceCents: null }))
    expect(res.status).toBe(200)
  })
})

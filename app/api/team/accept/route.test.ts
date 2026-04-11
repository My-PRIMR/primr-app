import { POST } from './route'

jest.mock('@/session', () => ({ getSession: jest.fn() }))
jest.mock('@/db', () => ({
  db: {
    query: {
      teamInvitations: { findFirst: jest.fn() },
      users: { findMany: jest.fn() },
      organizations: { findFirst: jest.fn() },
      planSubscriptions: { findFirst: jest.fn() },
    },
    update: jest.fn(() => ({
      set: jest.fn(() => ({ where: jest.fn().mockResolvedValue(undefined) })),
    })),
  },
}))

const { getSession } = require('@/session')
const { db } = require('@/db')

function req(body: object) {
  return new Request('http://localhost/api/team/accept', {
    method: 'POST',
    body: JSON.stringify(body),
    headers: { 'content-type': 'application/json' },
  })
}

describe('POST /api/team/accept', () => {
  beforeEach(() => jest.clearAllMocks())

  it('401 when not authed', async () => {
    getSession.mockResolvedValue(null)
    const res = await POST(req({ token: 'tok' }))
    expect(res.status).toBe(401)
  })

  it('404 when token not found', async () => {
    getSession.mockResolvedValue({ user: { id: 'u1' } })
    db.query.teamInvitations.findFirst.mockResolvedValue(null)
    const res = await POST(req({ token: 'tok' }))
    expect(res.status).toBe(404)
  })

  it('400 when invitation expired', async () => {
    getSession.mockResolvedValue({ user: { id: 'u1' } })
    db.query.teamInvitations.findFirst.mockResolvedValue({
      id: 'inv_1',
      organizationId: 'org1',
      status: 'pending',
      expiresAt: new Date(Date.now() - 1000),
    })
    const res = await POST(req({ token: 'tok' }))
    expect(res.status).toBe(400)
  })

  it('400 when org is full', async () => {
    getSession.mockResolvedValue({ user: { id: 'u1' } })
    db.query.teamInvitations.findFirst.mockResolvedValue({
      id: 'inv_1',
      organizationId: 'org1',
      status: 'pending',
      expiresAt: new Date(Date.now() + 3600000),
    })
    db.query.organizations.findFirst.mockResolvedValue({
      id: 'org1',
      seatLimit: 5,
    })
    db.query.users.findMany.mockResolvedValue([{}, {}, {}, {}, {}]) // 5 = full
    const res = await POST(req({ token: 'tok' }))
    expect(res.status).toBe(400)
  })

  it('400 when org has no active subscription', async () => {
    getSession.mockResolvedValue({ user: { id: 'u1' } })
    db.query.teamInvitations.findFirst.mockResolvedValue({
      id: 'inv_1',
      organizationId: 'org1',
      status: 'pending',
      expiresAt: new Date(Date.now() + 3600000),
    })
    db.query.organizations.findFirst.mockResolvedValue({
      id: 'org1',
      seatLimit: 5,
    })
    db.query.users.findMany.mockResolvedValue([{}]) // 1 member
    db.query.planSubscriptions.findFirst.mockResolvedValue(null)
    const res = await POST(req({ token: 'tok' }))
    expect(res.status).toBe(400)
  })

  it('accepts and updates user org and plan', async () => {
    getSession.mockResolvedValue({ user: { id: 'u1' } })
    db.query.teamInvitations.findFirst.mockResolvedValue({
      id: 'inv_1',
      organizationId: 'org1',
      status: 'pending',
      expiresAt: new Date(Date.now() + 3600000),
    })
    db.query.organizations.findFirst.mockResolvedValue({
      id: 'org1',
      seatLimit: 5,
    })
    db.query.users.findMany.mockResolvedValue([{}]) // 1 existing member
    db.query.planSubscriptions.findFirst.mockResolvedValue({
      id: 'ps_1',
      tier: 'teams',
      status: 'active',
    })
    const res = await POST(req({ token: 'tok' }))
    expect(res.status).toBe(200)
    expect(db.update).toHaveBeenCalled()
  })
})

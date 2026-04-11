import { POST } from './route'

jest.mock('@/session', () => ({ getSession: jest.fn() }))
jest.mock('@/lib/email', () => ({
  sendEmail: jest.fn().mockResolvedValue({ ok: true, id: 'em_1' }),
}))
jest.mock('@/db', () => ({
  db: {
    query: {
      users: { findFirst: jest.fn(), findMany: jest.fn() },
      organizations: { findFirst: jest.fn() },
      teamInvitations: { findMany: jest.fn() },
    },
    insert: jest.fn(() => ({
      values: jest.fn().mockResolvedValue(undefined),
    })),
  },
}))

const { getSession } = require('@/session')
const { db } = require('@/db')
const { sendEmail } = require('@/lib/email')

function req(body: object) {
  return new Request('http://localhost/api/team/invite', {
    method: 'POST',
    body: JSON.stringify(body),
    headers: { 'content-type': 'application/json' },
  })
}

describe('POST /api/team/invite', () => {
  beforeEach(() => jest.clearAllMocks())

  it('401 when not authed', async () => {
    getSession.mockResolvedValue(null)
    const res = await POST(req({ email: 'a@b.c' }))
    expect(res.status).toBe(401)
  })

  it('403 when user is not org owner', async () => {
    getSession.mockResolvedValue({ user: { id: 'u1' } })
    db.query.users.findFirst.mockResolvedValue({
      id: 'u1',
      organizationId: 'org1',
    })
    db.query.organizations.findFirst.mockResolvedValue({
      id: 'org1',
      ownerId: 'other_user',
      seatLimit: 5,
    })
    const res = await POST(req({ email: 'a@b.c' }))
    expect(res.status).toBe(403)
  })

  it('400 when seat limit reached', async () => {
    getSession.mockResolvedValue({ user: { id: 'u1' } })
    db.query.users.findFirst.mockResolvedValue({
      id: 'u1',
      organizationId: 'org1',
    })
    db.query.organizations.findFirst.mockResolvedValue({
      id: 'org1',
      ownerId: 'u1',
      seatLimit: 5,
    })
    db.query.users.findMany.mockResolvedValue([{}, {}, {}, {}, {}]) // 5 members
    db.query.teamInvitations.findMany.mockResolvedValue([])
    const res = await POST(req({ email: 'a@b.c' }))
    expect(res.status).toBe(400)
  })

  it('400 when email invalid', async () => {
    getSession.mockResolvedValue({ user: { id: 'u1' } })
    db.query.users.findFirst.mockResolvedValue({
      id: 'u1',
      organizationId: 'org1',
    })
    db.query.organizations.findFirst.mockResolvedValue({
      id: 'org1',
      ownerId: 'u1',
      seatLimit: 5,
    })
    db.query.users.findMany.mockResolvedValue([{}])
    db.query.teamInvitations.findMany.mockResolvedValue([])
    const res = await POST(req({ email: 'not-an-email' }))
    expect(res.status).toBe(400)
  })

  it('creates an invitation and sends email on success', async () => {
    getSession.mockResolvedValue({ user: { id: 'u1' } })
    db.query.users.findFirst.mockResolvedValue({
      id: 'u1',
      organizationId: 'org1',
    })
    db.query.organizations.findFirst.mockResolvedValue({
      id: 'org1',
      ownerId: 'u1',
      name: 'Acme',
      seatLimit: 5,
    })
    db.query.users.findMany.mockResolvedValue([{}])
    db.query.teamInvitations.findMany.mockResolvedValue([])

    const res = await POST(req({ email: 'new@example.com' }))
    expect(res.status).toBe(200)
    expect(sendEmail).toHaveBeenCalledWith(
      expect.objectContaining({
        to: 'new@example.com',
      }),
    )
  })
})

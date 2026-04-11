import { DELETE } from './route'

jest.mock('@/session', () => ({ getSession: jest.fn() }))
jest.mock('@/db', () => ({
  db: {
    query: {
      users: { findFirst: jest.fn() },
      organizations: { findFirst: jest.fn() },
    },
    update: jest.fn(() => ({
      set: jest.fn(() => ({ where: jest.fn().mockResolvedValue(undefined) })),
    })),
  },
}))

const { getSession } = require('@/session')
const { db } = require('@/db')

function req(): Request {
  return new Request('http://localhost/api/team/members/u2', {
    method: 'DELETE',
  })
}

describe('DELETE /api/team/members/[userId]', () => {
  beforeEach(() => jest.clearAllMocks())

  it('401 when not authed', async () => {
    getSession.mockResolvedValue(null)
    const res = await DELETE(req(), { params: Promise.resolve({ userId: 'u2' }) })
    expect(res.status).toBe(401)
  })

  it('400 when admin tries to remove self', async () => {
    getSession.mockResolvedValue({ user: { id: 'u1' } })
    const res = await DELETE(req(), { params: Promise.resolve({ userId: 'u1' }) })
    expect(res.status).toBe(400)
  })

  it('400 when current user has no organization', async () => {
    getSession.mockResolvedValue({ user: { id: 'u1' } })
    db.query.users.findFirst.mockResolvedValue({ id: 'u1', organizationId: null })
    const res = await DELETE(req(), { params: Promise.resolve({ userId: 'u2' }) })
    expect(res.status).toBe(400)
  })

  it('403 when current user is not org owner', async () => {
    getSession.mockResolvedValue({ user: { id: 'u1' } })
    db.query.users.findFirst.mockResolvedValue({ id: 'u1', organizationId: 'org1' })
    db.query.organizations.findFirst.mockResolvedValue({
      id: 'org1',
      ownerId: 'other_user',
    })
    const res = await DELETE(req(), { params: Promise.resolve({ userId: 'u2' }) })
    expect(res.status).toBe(403)
  })

  it('404 when target user is not in the org', async () => {
    getSession.mockResolvedValue({ user: { id: 'u1' } })
    db.query.users.findFirst
      .mockResolvedValueOnce({ id: 'u1', organizationId: 'org1' })
      .mockResolvedValueOnce({ id: 'u2', organizationId: 'other_org' })
    db.query.organizations.findFirst.mockResolvedValue({
      id: 'org1',
      ownerId: 'u1',
    })
    const res = await DELETE(req(), { params: Promise.resolve({ userId: 'u2' }) })
    expect(res.status).toBe(404)
  })

  it('downgrades target user when owner removes them', async () => {
    getSession.mockResolvedValue({ user: { id: 'u1' } })
    db.query.users.findFirst
      .mockResolvedValueOnce({ id: 'u1', organizationId: 'org1' })
      .mockResolvedValueOnce({ id: 'u2', organizationId: 'org1' })
    db.query.organizations.findFirst.mockResolvedValue({
      id: 'org1',
      ownerId: 'u1',
    })
    const res = await DELETE(req(), { params: Promise.resolve({ userId: 'u2' }) })
    expect(res.status).toBe(200)
    expect(db.update).toHaveBeenCalled()
  })
})

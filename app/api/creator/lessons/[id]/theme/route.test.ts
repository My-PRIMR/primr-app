import { PATCH } from './route'

jest.mock('@/session', () => ({ getSession: jest.fn() }))
jest.mock('@/db', () => ({
  db: {
    query: {
      lessons: { findFirst: jest.fn() },
      users: { findFirst: jest.fn() },
    },
    update: jest.fn(() => ({
      set: jest.fn(() => ({ where: jest.fn().mockResolvedValue(undefined) })),
    })),
  },
}))

const { getSession } = require('@/session')
const { db } = require('@/db')

function req(body: object) {
  return new Request('http://localhost/api/creator/lessons/L1/theme', {
    method: 'PATCH',
    body: JSON.stringify(body),
    headers: { 'content-type': 'application/json' },
  })
}

describe('PATCH /api/creator/lessons/[id]/theme', () => {
  beforeEach(() => jest.clearAllMocks())

  it('401 when not authed', async () => {
    getSession.mockResolvedValue(null)
    const res = await PATCH(req({ theme: 'chalk' }), {
      params: Promise.resolve({ id: 'L1' }),
    })
    expect(res.status).toBe(401)
  })

  it('404 when lesson missing', async () => {
    getSession.mockResolvedValue({ user: { id: 'u1' } })
    db.query.lessons.findFirst.mockResolvedValue(null)
    const res = await PATCH(req({ theme: 'chalk' }), {
      params: Promise.resolve({ id: 'L1' }),
    })
    expect(res.status).toBe(404)
  })

  it('403 when user does not own the lesson', async () => {
    getSession.mockResolvedValue({ user: { id: 'u1' } })
    db.query.lessons.findFirst.mockResolvedValue({ id: 'L1', createdBy: 'u2' })
    const res = await PATCH(req({ theme: 'chalk' }), {
      params: Promise.resolve({ id: 'L1' }),
    })
    expect(res.status).toBe(403)
  })

  it('400 for unknown theme id', async () => {
    getSession.mockResolvedValue({ user: { id: 'u1' } })
    db.query.lessons.findFirst.mockResolvedValue({ id: 'L1', createdBy: 'u1' })
    db.query.users.findFirst.mockResolvedValue({ id: 'u1', plan: 'pro' })
    const res = await PATCH(req({ theme: 'bogus' }), {
      params: Promise.resolve({ id: 'L1' }),
    })
    expect(res.status).toBe(400)
  })

  it('403 upgrade_required when theme tier exceeds user plan', async () => {
    getSession.mockResolvedValue({ user: { id: 'u1' } })
    db.query.lessons.findFirst.mockResolvedValue({ id: 'L1', createdBy: 'u1' })
    db.query.users.findFirst.mockResolvedValue({ id: 'u1', plan: 'free' })
    const res = await PATCH(req({ theme: 'chalk' }), {
      params: Promise.resolve({ id: 'L1' }),
    })
    expect(res.status).toBe(403)
    const body = await res.json()
    expect(body.error).toBe('upgrade_required')
    expect(body.requiredTier).toBe('pro')
  })

  it('200 on success', async () => {
    getSession.mockResolvedValue({ user: { id: 'u1' } })
    db.query.lessons.findFirst.mockResolvedValue({ id: 'L1', createdBy: 'u1' })
    db.query.users.findFirst.mockResolvedValue({ id: 'u1', plan: 'pro' })
    const res = await PATCH(req({ theme: 'chalk' }), {
      params: Promise.resolve({ id: 'L1' }),
    })
    expect(res.status).toBe(200)
    const body = await res.json()
    expect(body).toEqual({ id: 'L1', theme: 'chalk' })
  })
})

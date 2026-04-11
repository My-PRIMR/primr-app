import { PATCH } from './route'

jest.mock('@/session', () => ({ getSession: jest.fn() }))
jest.mock('@/db', () => ({
  db: {
    query: { courses: { findFirst: jest.fn() } },
    update: jest.fn(() => ({
      set: jest.fn(() => ({ where: jest.fn().mockResolvedValue(undefined) })),
    })),
  },
}))

const { getSession } = require('@/session')
const { db } = require('@/db')

function req(body: object) {
  return new Request('http://localhost/api/creator/courses/C1/pricing', {
    method: 'PATCH',
    body: JSON.stringify(body),
    headers: { 'content-type': 'application/json' },
  })
}

describe('PATCH /api/creator/courses/[id]/pricing', () => {
  beforeEach(() => jest.clearAllMocks())

  it('401 when not authed', async () => {
    getSession.mockResolvedValue(null)
    const res = await PATCH(req({ priceCents: 500, isPaid: true }), {
      params: Promise.resolve({ id: 'C1' }),
    })
    expect(res.status).toBe(401)
  })

  it('403 when user does not own the course', async () => {
    getSession.mockResolvedValue({ user: { id: 'u1' } })
    db.query.courses.findFirst.mockResolvedValue({ id: 'C1', createdBy: 'u2' })
    const res = await PATCH(req({ priceCents: 500, isPaid: true }), {
      params: Promise.resolve({ id: 'C1' }),
    })
    expect(res.status).toBe(403)
  })

  it('400 when price is below $0.99', async () => {
    getSession.mockResolvedValue({ user: { id: 'u1' } })
    db.query.courses.findFirst.mockResolvedValue({ id: 'C1', createdBy: 'u1' })
    const res = await PATCH(req({ priceCents: 50, isPaid: true }), {
      params: Promise.resolve({ id: 'C1' }),
    })
    expect(res.status).toBe(400)
  })

  it('200 on success, sets isPaid=false and clears price when free', async () => {
    getSession.mockResolvedValue({ user: { id: 'u1' } })
    db.query.courses.findFirst.mockResolvedValue({ id: 'C1', createdBy: 'u1' })
    const res = await PATCH(req({ priceCents: null, isPaid: false }), {
      params: Promise.resolve({ id: 'C1' }),
    })
    expect(res.status).toBe(200)
  })
})

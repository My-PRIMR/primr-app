import { POST } from './route'

jest.mock('@/session', () => ({ getSession: jest.fn() }))
jest.mock('@/lib/lesson-access', () => ({ canAccessLesson: jest.fn() }))
jest.mock('@/db', () => ({
  db: {
    query: {
      lessons: { findFirst: jest.fn() },
      lessonAttempts: { findFirst: jest.fn() },
    },
    insert: jest.fn(() => ({ values: jest.fn(() => ({ returning: jest.fn() })) })),
  },
}))

const { getSession } = require('@/session')
const { canAccessLesson } = require('@/lib/lesson-access')
const { db } = require('@/db')

function req(body: object = {}) {
  return new Request('http://localhost/api/lessons/l1/attempts', {
    method: 'POST',
    body: JSON.stringify(body),
    headers: { 'content-type': 'application/json' },
  })
}

const ctx = { params: Promise.resolve({ id: 'l1' }) }

describe('POST /api/lessons/:id/attempts', () => {
  beforeEach(() => {
    jest.clearAllMocks()
    getSession.mockResolvedValue({ user: { id: 'u1', email: 'a@b.c' } })
    canAccessLesson.mockResolvedValue(true)
    db.query.lessons.findFirst.mockResolvedValue({
      id: 'l1',
      manifest: { blocks: [{ id: 'b1', type: 'narrative' }, { id: 'b2', type: 'quiz' }] },
    })
  })

  it('returns the existing in-progress attempt for a non-exam lesson', async () => {
    db.query.lessonAttempts.findFirst.mockResolvedValue({
      id: 'att_existing',
      userId: 'u1',
      lessonId: 'l1',
      status: 'in_progress',
      blockResults: { b1: { status: 'complete' } },
      totalBlocks: 2,
    })

    const res = await POST(req() as any, ctx as any)
    expect(res.status).toBe(200)
    const data = await res.json()
    expect(data.attempt.id).toBe('att_existing')
    expect(data.attempt.blockResults).toEqual({ b1: { status: 'complete' } })
    expect(db.insert).not.toHaveBeenCalled()
  })
})

import { PATCH } from './route'

jest.mock('@/session', () => ({ getSession: jest.fn() }))
jest.mock('@/db', () => ({
  db: {
    query: { lessonAttempts: { findFirst: jest.fn() } },
    update: jest.fn(() => ({
      set: jest.fn(() => ({ where: jest.fn(() => ({ returning: jest.fn() })) })),
    })),
  },
}))

const { getSession } = require('@/session')
const { db } = require('@/db')

function req(body: object) {
  return new Request('http://localhost/api/attempts/att_1', {
    method: 'PATCH',
    body: JSON.stringify(body),
    headers: { 'content-type': 'application/json' },
  })
}

const ctx = { params: Promise.resolve({ attemptId: 'att_1' }) }

describe('PATCH /api/attempts/:attemptId', () => {
  beforeEach(() => {
    jest.clearAllMocks()
    getSession.mockResolvedValue({ user: { id: 'u1' } })
  })

  it('merges a single blockResult without changing status', async () => {
    db.query.lessonAttempts.findFirst.mockResolvedValue({
      id: 'att_1',
      userId: 'u1',
      status: 'in_progress',
      blockResults: { b1: { status: 'complete' } },
    })
    const returning = jest.fn().mockResolvedValue([{ id: 'att_1' }])
    const where = jest.fn(() => ({ returning }))
    const set = jest.fn(() => ({ where }))
    db.update = jest.fn(() => ({ set }))

    const res = await PATCH(
      req({ blockResult: { blockId: 'b2', status: 'complete', score: 1 } }) as any,
      ctx as any,
    )
    expect(res.status).toBe(200)
    expect(set).toHaveBeenCalledWith(
      expect.objectContaining({
        blockResults: {
          b1: { status: 'complete' },
          b2: { blockId: 'b2', status: 'complete', score: 1 },
        },
      }),
    )
    // Must NOT mark completion in partial mode
    expect(set.mock.calls[0][0]).not.toHaveProperty('status', 'completed')
    expect(set.mock.calls[0][0]).not.toHaveProperty('completedAt')
  })

  it('full payload still marks completion (existing behavior)', async () => {
    const returning = jest.fn().mockResolvedValue([{ id: 'att_1' }])
    const where = jest.fn(() => ({ returning }))
    const set = jest.fn(() => ({ where }))
    db.update = jest.fn(() => ({ set }))

    const res = await PATCH(
      req({
        score: 0.8,
        scoredBlocks: 5,
        blockResults: { b1: { status: 'complete' } },
      }) as any,
      ctx as any,
    )
    expect(res.status).toBe(200)
    expect(set).toHaveBeenCalledWith(
      expect.objectContaining({
        status: 'completed',
        score: 0.8,
        scoredBlocks: 5,
        completedAt: expect.any(Date),
      }),
    )
  })

  it('repeated blockResult PATCHes for the same blockId are idempotent (last write wins)', async () => {
    db.query.lessonAttempts.findFirst.mockResolvedValue({
      id: 'att_1',
      userId: 'u1',
      status: 'in_progress',
      blockResults: { b2: { blockId: 'b2', status: 'complete', score: 0.5 } },
    })
    const returning = jest.fn().mockResolvedValue([{ id: 'att_1' }])
    const where = jest.fn(() => ({ returning }))
    const set = jest.fn(() => ({ where }))
    db.update = jest.fn(() => ({ set }))

    await PATCH(
      req({ blockResult: { blockId: 'b2', status: 'complete', score: 1.0 } }) as any,
      ctx as any,
    )
    expect(set).toHaveBeenCalledWith(
      expect.objectContaining({
        blockResults: { b2: { blockId: 'b2', status: 'complete', score: 1.0 } },
      }),
    )
  })
})

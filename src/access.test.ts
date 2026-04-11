import { hasAccessToLesson } from './access'

jest.mock('@/db', () => ({
  db: {
    query: {
      lessons: { findFirst: jest.fn() },
      purchases: { findFirst: jest.fn() },
      subscriptions: { findFirst: jest.fn() },
    },
  },
}))

const { db } = require('@/db')

describe('hasAccessToLesson', () => {
  beforeEach(() => jest.clearAllMocks())

  it('grants access to system lessons for anyone', async () => {
    db.query.lessons.findFirst.mockResolvedValue({
      id: 'L1',
      createdBy: 'creator',
      isSystem: true,
      isPaid: true,
      priceCents: 500,
    })
    expect(await hasAccessToLesson('learner', 'L1')).toBe(true)
  })

  it('grants access to the creator of the lesson', async () => {
    db.query.lessons.findFirst.mockResolvedValue({
      id: 'L1',
      createdBy: 'creator',
      isSystem: false,
      isPaid: true,
      priceCents: 500,
    })
    expect(await hasAccessToLesson('creator', 'L1')).toBe(true)
  })

  it('grants access to free lessons', async () => {
    db.query.lessons.findFirst.mockResolvedValue({
      id: 'L1',
      createdBy: 'creator',
      isSystem: false,
      isPaid: false,
      priceCents: null,
    })
    db.query.purchases.findFirst.mockResolvedValue(null)
    db.query.subscriptions.findFirst.mockResolvedValue(null)
    expect(await hasAccessToLesson('learner', 'L1')).toBe(true)
  })

  it('grants access when learner has an active subscription to the creator', async () => {
    db.query.lessons.findFirst.mockResolvedValue({
      id: 'L1',
      createdBy: 'creator',
      isSystem: false,
      isPaid: true,
      priceCents: 500,
    })
    db.query.subscriptions.findFirst.mockResolvedValue({
      subscriberId: 'learner',
      creatorId: 'creator',
      status: 'active',
    })
    expect(await hasAccessToLesson('learner', 'L1')).toBe(true)
  })

  it('grants access when learner has a purchase for this lesson', async () => {
    db.query.lessons.findFirst.mockResolvedValue({
      id: 'L1',
      createdBy: 'creator',
      isSystem: false,
      isPaid: true,
      priceCents: 500,
    })
    db.query.subscriptions.findFirst.mockResolvedValue(null)
    db.query.purchases.findFirst.mockResolvedValue({
      buyerId: 'learner',
      lessonId: 'L1',
    })
    expect(await hasAccessToLesson('learner', 'L1')).toBe(true)
  })

  it('denies access when paid and no purchase or subscription', async () => {
    db.query.lessons.findFirst.mockResolvedValue({
      id: 'L1',
      createdBy: 'creator',
      isSystem: false,
      isPaid: true,
      priceCents: 500,
    })
    db.query.subscriptions.findFirst.mockResolvedValue(null)
    db.query.purchases.findFirst.mockResolvedValue(null)
    expect(await hasAccessToLesson('learner', 'L1')).toBe(false)
  })

  it('denies access when lesson does not exist', async () => {
    db.query.lessons.findFirst.mockResolvedValue(null)
    expect(await hasAccessToLesson('learner', 'missing')).toBe(false)
  })

  it('denies access for anonymous users to paid content', async () => {
    db.query.lessons.findFirst.mockResolvedValue({
      id: 'L1',
      createdBy: 'creator',
      isSystem: false,
      isPaid: true,
      priceCents: 500,
    })
    expect(await hasAccessToLesson(null, 'L1')).toBe(false)
  })
})

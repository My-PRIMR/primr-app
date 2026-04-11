/**
 * Unit tests for POST /api/teacher-application.
 * Mocks the DB and Cloudinary to exercise validation logic in isolation.
 */
import { NextRequest } from 'next/server'

// Mock Cloudinary upload so we don't hit the network.
jest.mock('@/lib/cloudinary', () => ({
  uploadBuffer: jest.fn().mockResolvedValue('https://res.cloudinary.com/test/raw/upload/v1/teacher_proofs/fake.pdf'),
}))

// Capture every Drizzle insert call, in order. The route does:
//   1. tx.insert(users).values({...})        (if user doesn't exist)
//   2. tx.insert(teacherApplications).values({...})
// With findFirst always returning undefined, we get both inserts, and the
// teacher-application row is the one with a `schoolName` field.
const insertedRows: Array<Record<string, unknown>> = []

jest.mock('@/db', () => {
  const tx = {
    query: {
      users: {
        findFirst: jest.fn().mockResolvedValue(undefined),
      },
    },
    insert: jest.fn(() => ({
      values: jest.fn((row: Record<string, unknown>) => {
        insertedRows.push(row)
        return {
          returning: jest.fn().mockResolvedValue([{ ...row, id: 'fake-id-' + insertedRows.length }]),
        }
      }),
    })),
  }
  return {
    db: {
      transaction: jest.fn(async (fn: (tx: unknown) => Promise<void>) => {
        await fn(tx)
      }),
    },
  }
})

// Import the route AFTER the mocks so they're applied.
import { POST } from './route'

function makeRequest(fields: Record<string, string | File>, headers: Record<string, string> = {}): NextRequest {
  const fd = new FormData()
  for (const [k, v] of Object.entries(fields)) {
    fd.append(k, v)
  }
  return new NextRequest('http://localhost/api/teacher-application', {
    method: 'POST',
    body: fd,
    headers,
  })
}

function makeValidFields(overrides: Partial<Record<string, string>> = {}): Record<string, string | File> {
  const pdf = new File([Buffer.from('%PDF-1.4 fake')], 'proof.pdf', { type: 'application/pdf' })
  return {
    name: 'Ada Lovelace',
    email: 'ada@school.edu',
    schoolName: 'Analytical Academy',
    gradeLevel: 'High 9-12',
    currentRole: 'Classroom teacher',
    proof: pdf,
    ...overrides,
  }
}

/** Finds the teacher-application insert row (distinguishable by `schoolName`). */
function insertedApplication(): Record<string, unknown> | undefined {
  return insertedRows.find((row) => 'schoolName' in row)
}

beforeEach(() => {
  insertedRows.length = 0
})

// Each test sets a unique x-forwarded-for so it doesn't share the rate-limit
// bucket with other tests in the file. Without this, every source/honeypot
// test lands in the 'unknown' bucket and can exhaust it.
describe('POST /api/teacher-application — source field', () => {
  it('defaults source to "in_app" when not provided', async () => {
    const res = await POST(makeRequest(makeValidFields(), { 'x-forwarded-for': '192.0.2.1' }))
    expect(res.status).toBe(200)
    expect(insertedApplication()).toBeDefined()
    expect(insertedApplication()?.source).toBe('in_app')
  })

  it('accepts source="marketing"', async () => {
    const res = await POST(makeRequest(makeValidFields({ source: 'marketing' }), { 'x-forwarded-for': '192.0.2.2' }))
    expect(res.status).toBe(200)
    expect(insertedApplication()?.source).toBe('marketing')
  })

  it('accepts source="in_app"', async () => {
    const res = await POST(makeRequest(makeValidFields({ source: 'in_app' }), { 'x-forwarded-for': '192.0.2.3' }))
    expect(res.status).toBe(200)
    expect(insertedApplication()?.source).toBe('in_app')
  })

  it('rejects invalid source values', async () => {
    const res = await POST(makeRequest(makeValidFields({ source: 'web-scraper' }), { 'x-forwarded-for': '192.0.2.4' }))
    expect(res.status).toBe(400)
    const body = await res.json()
    expect(body.error).toMatch(/source/i)
    expect(insertedApplication()).toBeUndefined()
  })
})

describe('POST /api/teacher-application — honeypot', () => {
  it('silently drops submissions with a filled honeypot field', async () => {
    const res = await POST(makeRequest(makeValidFields({ website: 'http://spambot.example' }), { 'x-forwarded-for': '192.0.2.5' }))
    expect(res.status).toBe(200)
    const body = await res.json()
    expect(body.ok).toBe(true)
    // No DB insert, no upload
    expect(insertedApplication()).toBeUndefined()
  })

  it('allows submissions with an empty honeypot field', async () => {
    const res = await POST(makeRequest(makeValidFields({ website: '' }), { 'x-forwarded-for': '192.0.2.6' }))
    expect(res.status).toBe(200)
    expect(insertedApplication()).toBeDefined()
  })
})

describe('POST /api/teacher-application — rate limit', () => {
  it('allows up to 5 submissions per IP per hour', async () => {
    for (let i = 0; i < 5; i++) {
      const res = await POST(makeRequest(makeValidFields({ email: `u${i}@school.edu` }), { 'x-forwarded-for': '10.0.0.1' }))
      expect(res.status).toBe(200)
    }
  })

  it('returns 429 on the 6th submission from the same IP', async () => {
    for (let i = 0; i < 5; i++) {
      await POST(makeRequest(makeValidFields({ email: `u${i}@school.edu` }), { 'x-forwarded-for': '10.0.0.2' }))
    }
    const res = await POST(makeRequest(makeValidFields({ email: 'u6@school.edu' }), { 'x-forwarded-for': '10.0.0.2' }))
    expect(res.status).toBe(429)
    const body = await res.json()
    expect(body.error).toMatch(/too many/i)
  })

  it('tracks IPs independently', async () => {
    for (let i = 0; i < 5; i++) {
      await POST(makeRequest(makeValidFields({ email: `a${i}@school.edu` }), { 'x-forwarded-for': '10.0.0.3' }))
    }
    // A different IP should still be allowed.
    const res = await POST(makeRequest(makeValidFields({ email: 'b@school.edu' }), { 'x-forwarded-for': '10.0.0.4' }))
    expect(res.status).toBe(200)
  })
})

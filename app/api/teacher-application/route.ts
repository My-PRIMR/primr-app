import { NextRequest, NextResponse } from 'next/server'
import { db } from '@/db'
import { users, teacherApplications } from '@/db/schema'
import { eq } from 'drizzle-orm'
import { uploadBuffer, type UploadFormat } from '@/lib/cloudinary'

const MAX_FILE_SIZE = 5 * 1024 * 1024 // 5 MB

const ALLOWED_FORMATS: Record<string, UploadFormat> = {
  'image/png': 'png',
  'image/jpeg': 'jpg',
  'image/webp': 'webp',
  'application/pdf': 'pdf',
}

const ALLOWED_GRADE_LEVELS = new Set(['Elementary K-5', 'Middle 6-8', 'High 9-12', 'Other K-12'])
const ALLOWED_ROLES = new Set(['Classroom teacher', 'Specialist', 'Substitute', 'Administrator', 'Other'])

const EMAIL_RE = /^[^\s@]+@[^\s@]+\.[^\s@]+$/

// Note: this endpoint trusts the browser-reported MIME type. Cloudinary validates
// images at upload time, and PDFs are stored as 'raw' resources served from a
// different origin (res.cloudinary.com), so the practical XSS risk is low. If a
// stronger guarantee is needed later, add 4-byte magic-number sniffing here.

export async function POST(req: NextRequest) {
  // Cheap early-out for honest oversize uploads. Real defense is nginx
  // client_max_body_size in primr-root, plus the size check after parse.
  const contentLength = Number(req.headers.get('content-length') ?? 0)
  if (contentLength > MAX_FILE_SIZE + 64 * 1024) {
    return NextResponse.json({ error: 'Upload too large.' }, { status: 413 })
  }

  try {
    const formData = await req.formData()
    const name = (formData.get('name') as string | null)?.trim()
    const email = (formData.get('email') as string | null)?.trim().toLowerCase()
    const schoolName = (formData.get('schoolName') as string | null)?.trim()
    const gradeLevel = (formData.get('gradeLevel') as string | null)?.trim()
    const currentRole = (formData.get('currentRole') as string | null)?.trim()
    const proof = formData.get('proof') as File | null

    if (!name || !email || !schoolName || !gradeLevel || !currentRole || !proof) {
      return NextResponse.json({ error: 'All fields are required.' }, { status: 400 })
    }
    if (!EMAIL_RE.test(email)) {
      return NextResponse.json({ error: 'Please enter a valid email address.' }, { status: 400 })
    }
    if (!ALLOWED_GRADE_LEVELS.has(gradeLevel)) {
      return NextResponse.json({ error: 'Invalid grade level.' }, { status: 400 })
    }
    if (!ALLOWED_ROLES.has(currentRole)) {
      return NextResponse.json({ error: 'Invalid current role.' }, { status: 400 })
    }
    if (proof.size > MAX_FILE_SIZE) {
      return NextResponse.json({ error: 'Proof document must be 5 MB or smaller.' }, { status: 400 })
    }
    const format = ALLOWED_FORMATS[proof.type]
    if (!format) {
      return NextResponse.json({ error: 'Proof document must be PDF, PNG, JPG, or WebP.' }, { status: 400 })
    }

    // Upload to Cloudinary. publicId scoped under teacher_proofs/ with a timestamp + sanitized email.
    const buffer = Buffer.from(await proof.arrayBuffer())
    const publicId = `teacher_proofs/${Date.now()}_${email.replace(/[^a-z0-9]/g, '_')}`
    const proofUrl = await uploadBuffer(buffer, format, publicId)

    // Find-or-create user + insert application atomically. Without the transaction,
    // a failure on the application insert (other than the duplicate-pending case)
    // would leave an orphaned passwordless user row behind.
    try {
      await db.transaction(async (tx) => {
        // Find or create the user. If creating, productRole is 'creator' so they can
        // later access the creator dashboard once promoted to teacher.
        let user = await tx.query.users.findFirst({ where: eq(users.email, email) })
        if (!user) {
          const [created] = await tx.insert(users).values({
            email,
            name,
            productRole: 'creator',
            plan: 'free',
          }).returning()
          user = created
        }

        await tx.insert(teacherApplications).values({
          userId: user.id,
          schoolName,
          gradeLevel,
          proofDocumentUrl: proofUrl,
          // status defaults to 'pending'
        })
      })
    } catch (err: unknown) {
      // Postgres unique_violation = 23505. The partial unique index name narrows it
      // to the specific "already pending" case. Both checks together are race-free
      // and rename-tolerant (the constraint name lives next to the index in schema.ts).
      const pgErr = err as { code?: string; constraint_name?: string; constraint?: string }
      const constraintName = pgErr.constraint_name ?? pgErr.constraint
      if (pgErr.code === '23505' && constraintName === 'teacher_applications_one_pending_per_user') {
        return NextResponse.json({
          error: 'You already have a pending application. We will review it shortly.',
        }, { status: 409 })
      }
      throw err
    }

    return NextResponse.json({ ok: true })
  } catch (err) {
    console.error('[teacher-application]', err)
    return NextResponse.json({ error: 'Failed to submit application.' }, { status: 500 })
  }
}

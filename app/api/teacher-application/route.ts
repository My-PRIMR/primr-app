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

export async function POST(req: NextRequest) {
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

    // Find or create the user. If creating, productRole is 'creator' so they can later
    // access the creator dashboard once promoted to teacher.
    let user = await db.query.users.findFirst({ where: eq(users.email, email) })
    if (!user) {
      const [created] = await db.insert(users).values({
        email,
        name,
        productRole: 'creator',
        plan: 'free',
      }).returning()
      user = created
    }

    // Insert the application. The partial unique index on (user_id) WHERE status='pending'
    // will fail with a constraint violation if the same user already has a pending application.
    try {
      await db.insert(teacherApplications).values({
        userId: user.id,
        schoolName,
        gradeLevel,
        proofDocumentUrl: proofUrl,
        // status defaults to 'pending'
      })
    } catch (err: unknown) {
      if (err instanceof Error && err.message.includes('teacher_applications_one_pending_per_user')) {
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

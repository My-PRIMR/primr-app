// primr-app/scripts/seed-pro-teacher-onboarding.ts
import 'dotenv/config'
import { db } from '../src/db'
import { lessons, onboardingPlaylists } from '../src/db/schema'
import { buildYourFirstCourseLesson } from '../../primr-components/src/lessons/build-your-first-course'
import { manageYourClassLesson } from '../../primr-components/src/lessons/manage-your-class'
import type { LessonManifest } from '../../primr-components/src/types'
import { eq, inArray } from 'drizzle-orm'

async function upsertLesson(manifest: LessonManifest): Promise<string> {
  const existing = await db
    .select({ id: lessons.id })
    .from(lessons)
    .where(eq(lessons.slug, manifest.slug))
    .limit(1)

  if (existing.length > 0) {
    await db
      .update(lessons)
      .set({
        title: manifest.title,
        manifest: manifest,
        isSystem: true,
        updatedAt: new Date(),
      })
      .where(eq(lessons.slug, manifest.slug))
    console.log(`Updated existing lesson: ${manifest.slug} (${existing[0].id})`)
    return existing[0].id
  } else {
    const [inserted] = await db
      .insert(lessons)
      .values({
        slug: manifest.slug,
        title: manifest.title,
        manifest: manifest,
        isSystem: true,
        publishedAt: new Date(),
        examEnforced: false,
      })
      .returning({ id: lessons.id })
    console.log(`Inserted new lesson: ${manifest.slug} (${inserted.id})`)
    return inserted.id
  }
}

async function seed() {
  // 1. Upsert both new lessons
  const courseOnboardingId = await upsertLesson(buildYourFirstCourseLesson)
  const classOnboardingId = await upsertLesson(manageYourClassLesson)

  // 2. Look up the existing creator_free lesson by slug
  const freeLesson = await db
    .select({ id: lessons.id })
    .from(lessons)
    .where(eq(lessons.slug, 'create-your-first-lesson'))
    .limit(1)

  if (freeLesson.length === 0) {
    throw new Error(
      'creator_free lesson not found — run seed-creator-free-onboarding.ts first'
    )
  }
  const freeLessonId = freeLesson[0].id

  // 3–5. Atomically rebuild playlist rows for creator_pro and teacher segments
  await db.transaction(async (tx) => {
    // 3. Clear existing playlist rows (idempotent — safe to re-run)
    await tx
      .delete(onboardingPlaylists)
      .where(
        inArray(onboardingPlaylists.segment, ['creator_pro', 'teacher'])
      )
    console.log('Cleared existing creator_pro and teacher playlist rows')

    // 4. Insert creator_pro playlist: positions 1–2
    await tx.insert(onboardingPlaylists).values([
      { segment: 'creator_pro', lessonId: freeLessonId,       displayOrder: 1 },
      { segment: 'creator_pro', lessonId: courseOnboardingId, displayOrder: 2 },
    ])
    console.log('Inserted creator_pro playlist (2 lessons)')

    // 5. Insert teacher playlist: positions 1–3
    await tx.insert(onboardingPlaylists).values([
      { segment: 'teacher', lessonId: freeLessonId,       displayOrder: 1 },
      { segment: 'teacher', lessonId: courseOnboardingId, displayOrder: 2 },
      { segment: 'teacher', lessonId: classOnboardingId,  displayOrder: 3 },
    ])
    console.log('Inserted teacher playlist (3 lessons)')
  })

  console.log('Done.')
  process.exit(0)
}

seed().catch(err => {
  console.error(err)
  process.exit(1)
})

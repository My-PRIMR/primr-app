import 'dotenv/config'
import { db } from '../src/db'
import { lessons, onboardingPlaylists } from '../src/db/schema'
import { creatorFreeOnboardingLesson } from '../../primr-components/src/lessons/creator-free-onboarding'
import { eq, and } from 'drizzle-orm'

async function seed() {
  const manifest = creatorFreeOnboardingLesson

  // Upsert lesson — idempotent by slug
  const existing = await db
    .select({ id: lessons.id })
    .from(lessons)
    .where(eq(lessons.slug, manifest.slug))
    .limit(1)

  let lessonId: string

  if (existing.length > 0) {
    lessonId = existing[0].id
    await db
      .update(lessons)
      .set({
        title: manifest.title,
        manifest: manifest,
        isSystem: true,
        publishedAt: new Date(),
        updatedAt: new Date(),
      })
      .where(eq(lessons.slug, manifest.slug))
    console.log(`Updated existing lesson: ${lessonId}`)
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
    lessonId = inserted.id
    console.log(`Inserted new lesson: ${lessonId}`)
  }

  // Replace playlist entry — delete any existing row for this segment+displayOrder first
  // (onConflictDoNothing would silently skip if a stale row existed with a different lessonId)
  await db
    .delete(onboardingPlaylists)
    .where(and(eq(onboardingPlaylists.segment, 'creator_free'), eq(onboardingPlaylists.displayOrder, 1)))
  await db
    .insert(onboardingPlaylists)
    .values({
      segment: 'creator_free',
      lessonId: lessonId,
      displayOrder: 1,
    })

  console.log(`Registered in onboarding_playlists for segment: creator_free, displayOrder: 1`)
  console.log('Done.')
  process.exit(0)
}

seed().catch(err => {
  console.error(err)
  process.exit(1)
})

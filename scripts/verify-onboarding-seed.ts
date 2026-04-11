import 'dotenv/config'
import { db } from '../src/db'
import { lessons, onboardingPlaylists } from '../src/db/schema'
import { eq } from 'drizzle-orm'

async function verify() {
  const rows = await db
    .select({ id: lessons.id, isSystem: lessons.isSystem, publishedAt: lessons.publishedAt })
    .from(lessons)
    .where(eq(lessons.slug, 'create-your-first-lesson'))

  console.log('Lesson:', JSON.stringify(rows[0]))

  const playlist = await db
    .select()
    .from(onboardingPlaylists)
    .where(eq(onboardingPlaylists.segment, 'creator_free'))

  console.log('Playlist:', JSON.stringify(playlist))
  process.exit(0)
}

verify().catch(err => {
  console.error(err)
  process.exit(1)
})

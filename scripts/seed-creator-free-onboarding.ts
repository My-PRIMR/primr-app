import 'dotenv/config'
import { db } from '../src/db'
import { lessons, onboardingPlaylists } from '../src/db/schema'
import { eq, and } from 'drizzle-orm'

// Inlined from primr-components/src/lessons/creator-free-onboarding.ts to
// avoid importing source files at deploy time (dist is gitignored).
const creatorFreeOnboardingLesson = {
  id: 'create-your-first-lesson',
  title: 'Create Your First Lesson',
  slug: 'create-your-first-lesson',
  blocks: [
    {
      id: 'hero',
      type: 'hero',
      props: {
        title: 'Upload a doc. Get a lesson.',
        tagline:
          "In the next few minutes you\u2019ll turn a real document into an interactive lesson your learners can actually complete.",
        meta: [
          { label: '3 min' },
          { label: 'Getting started' },
          { label: 'Creators' },
        ],
      },
    },
    {
      id: 'how-it-works',
      type: 'narrative',
      props: {
        eyebrow: 'HOW IT WORKS',
        title: 'From document to interactive lesson — automatically',
        body: "You upload a document — a PDF, a training guide, a how-to — and Primr reads it, understands it, and builds a structured lesson with knowledge checks and a final assessment. You don't write a single question. You review and refine what it produces, then publish when you're ready.",
      },
    },
    {
      id: 'workflow',
      type: 'step-navigator',
      props: {
        title: "Here's what you'll do",
        steps: [
          {
            title: 'Upload your document',
            body: 'Choose a PDF or Word doc — or use one of our sample files in the next section.',
          },
          {
            title: 'Watch Primr generate your lesson',
            body: 'Takes about 30 seconds. The AI reads the doc and builds a full lesson.',
          },
          {
            title: 'Preview and explore',
            body: 'Walk through your lesson as a learner would before you publish.',
          },
        ],
      },
    },
    {
      id: 'sample-files',
      type: 'narrative',
      props: {
        eyebrow: 'SAMPLE FILES',
        title: "Don't have a doc handy? Use one of ours.",
        body: "We've prepared two sample PDFs — each with embedded images — so you can experience the full generation process right now. Pick whichever feels closer to what you'll be creating.\n\n**[📋 Onboarding New Employees](/samples/onboarding-new-employees.pdf)** — For HR, L&D, and people managers\n\n**[📷 Introduction to Street Photography](/samples/intro-to-street-photography.pdf)** — For independent creators and coaches",
      },
    },
    {
      id: 'before-publish',
      type: 'narrative',
      props: {
        eyebrow: 'BEFORE YOU PUBLISH',
        title: 'Your lesson is a draft — take it for a spin',
        body: "Once generation is complete, you'll land in the Preview. Walk through your lesson the way a learner would: read the content, answer the questions, see how it flows. When you're happy, hit Publish. You can always edit and re-publish later.",
      },
    },
  ],
}

async function seed() {
  const manifest = creatorFreeOnboardingLesson

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
        manifest: manifest as never,
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
        manifest: manifest as never,
        isSystem: true,
        publishedAt: new Date(),
        examEnforced: false,
      })
      .returning({ id: lessons.id })
    lessonId = inserted.id
    console.log(`Inserted new lesson: ${lessonId}`)
  }

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

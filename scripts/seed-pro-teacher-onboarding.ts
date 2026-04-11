// primr-app/scripts/seed-pro-teacher-onboarding.ts
import 'dotenv/config'
import { db } from '../src/db'
import { lessons, onboardingPlaylists } from '../src/db/schema'
import { eq, inArray } from 'drizzle-orm'

// Inlined from primr-components/src/lessons/ to avoid importing source files
// at deploy time (dist is gitignored; source imports break Next.js build).
const buildYourFirstCourseLesson = {
  id: 'build-your-first-course',
  title: 'Build Your First Course',
  slug: 'build-your-first-course',
  blocks: [
    {
      id: 'hero',
      type: 'hero',
      props: {
        title: 'One doc. An entire course.',
        tagline:
          "Upload a document and Primr will propose a full course outline — sections, chapters, and lessons. You review the structure, make any edits, then confirm. Generation starts only when you're ready.",
        meta: [{ label: '3 min' }, { label: 'Courses' }, { label: 'Creators' }],
      },
    },
    {
      id: 'how-it-works',
      type: 'narrative',
      props: {
        eyebrow: 'HOW IT WORKS',
        title: 'A course is a document, organized',
        body: "Primr reads your document and proposes a course outline — sections, chapters, and individual lessons — based on what's in the doc. You review and adjust the structure before a single lesson is generated.",
      },
    },
    {
      id: 'the-outline',
      type: 'narrative',
      props: {
        eyebrow: 'THE OUTLINE',
        title: "You're in control before generation starts",
        body: "After analysis, you'll see a tree of your proposed course. Add, remove, or rename any section, chapter, or lesson. Exclude anything that doesn't belong. Only then do you confirm and kick off generation.",
      },
    },
    {
      id: 'workflow',
      type: 'step-navigator',
      props: {
        title: "Here's what you'll do",
        steps: [
          {
            title: 'Go to Courses → New Course and upload your document',
            body: 'Use a PDF or Word doc — a training guide, a textbook chapter, a how-to manual.',
          },
          {
            title: 'Review the outline Primr proposes',
            body: "Edit titles, exclude anything you don't need, add lessons if something is missing.",
          },
          {
            title: 'Confirm and watch Primr generate each lesson',
            body: 'Generation runs lesson by lesson. You can watch progress in real time.',
          },
          {
            title: 'Preview the finished course as a learner, then publish',
            body: "Walk through the course the way your learners will before you share it.",
          },
        ],
      },
    },
    {
      id: 'after-generation',
      type: 'narrative',
      props: {
        eyebrow: 'AFTER GENERATION',
        title: 'Your lessons are drafts — make them yours',
        body: "Each generated lesson is ready to preview and refine. Walk through them, edit any content that needs polish, then publish the course when you're satisfied. You can always update and re-publish later.",
      },
    },
  ],
}

const manageYourClassLesson = {
  id: 'manage-your-class',
  title: 'Manage Your Class',
  slug: 'manage-your-class',
  blocks: [
    {
      id: 'hero',
      type: 'hero',
      props: {
        title: 'Your class, your content, your results.',
        tagline:
          'Learn how to add students to your lessons and courses, and track their progress from one place.',
        meta: [{ label: '3 min' }, { label: 'Students' }, { label: 'Teachers' }],
      },
    },
    {
      id: 'students-tab',
      type: 'narrative',
      props: {
        eyebrow: 'THE STUDENTS TAB',
        title: 'Your whole class in one view',
        body: "The Students tab on your dashboard shows everyone you've added across all your lessons and courses — with lessons started, lessons completed, average scores, and last activity. As your class grows, it stays in one place.",
      },
    },
    {
      id: 'adding-students',
      type: 'narrative',
      props: {
        eyebrow: 'ADDING STUDENTS',
        title: 'Two ways to bring students in',
        body: "Open any lesson or course and hit Share. You can add students by email directly — they'll get an invitation — or copy an invite link to post in your LMS, email, or wherever your class lives. Both methods work for lessons and courses.",
      },
    },
    {
      id: 'workflow',
      type: 'step-navigator',
      props: {
        title: "Here's what you'll do",
        steps: [
          {
            title: 'Open a lesson or course and click Share',
            body: 'The Share panel works the same way for both lessons and courses.',
          },
          {
            title: 'Add student emails directly, or copy the invite link',
            body: 'Paste the link into your LMS, email, or any platform where your class is.',
          },
          {
            title: 'Students accept and start working through the content',
            body: "Students land directly in the lesson or course — no account required to get started.",
          },
          {
            title: 'Check the Students tab to monitor progress and scores',
            body: 'Results update automatically as students complete lessons and assessments.',
          },
        ],
      },
    },
    {
      id: 'progress',
      type: 'narrative',
      props: {
        eyebrow: 'STAYING ON TOP OF PROGRESS',
        title: 'Results update as students work',
        body: "You don't need to do anything after inviting students. As they complete lessons and assessments, their scores and activity appear automatically in your Students tab. If something looks off, you can revisit the lesson and refine it anytime.",
      },
    },
  ],
}

async function upsertLesson(manifest: typeof buildYourFirstCourseLesson): Promise<string> {
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
        manifest: manifest as never,
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
        manifest: manifest as never,
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
  const courseOnboardingId = await upsertLesson(buildYourFirstCourseLesson)
  const classOnboardingId = await upsertLesson(manageYourClassLesson)

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

  await db.transaction(async (tx) => {
    await tx
      .delete(onboardingPlaylists)
      .where(inArray(onboardingPlaylists.segment, ['creator_pro', 'teacher']))
    console.log('Cleared existing creator_pro and teacher playlist rows')

    await tx.insert(onboardingPlaylists).values([
      { segment: 'creator_pro', lessonId: freeLessonId,       displayOrder: 1 },
      { segment: 'creator_pro', lessonId: courseOnboardingId, displayOrder: 2 },
    ])
    console.log('Inserted creator_pro playlist (2 lessons)')

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

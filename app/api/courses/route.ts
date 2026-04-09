import { NextRequest, NextResponse } from 'next/server'
import { db } from '@/db'
import { courses, chapterLessons, courseChapters, courseSections } from '@/db/schema'
import { eq, desc, sql, and } from 'drizzle-orm'
import { getSession } from '@/session'
import { canCreateCourses } from '@/lib/models'

function slugify(text: string): string {
  return text
    .toLowerCase()
    .replace(/[^a-z0-9\s-]/g, '')
    .trim()
    .replace(/\s+/g, '-')
    .replace(/-+/g, '-')
}

// GET /api/courses — list creator's courses with lesson counts
export async function GET() {
  const session = await getSession()
  if (!session?.user?.id) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })

  const rows = await db
    .select({
      id: courses.id,
      title: courses.title,
      slug: courses.slug,
      description: courses.description,
      isPublic: courses.isPublic,
      status: courses.status,
      createdAt: courses.createdAt,
      updatedAt: courses.updatedAt,
      lessonCount: sql<number>`count(${chapterLessons.id})::int`,
      doneCount: sql<number>`count(case when ${chapterLessons.generationStatus} = 'done' then 1 end)::int`,
    })
    .from(courses)
    .leftJoin(courseSections, eq(courseSections.courseId, courses.id))
    .leftJoin(courseChapters, eq(courseChapters.sectionId, courseSections.id))
    .leftJoin(chapterLessons, eq(chapterLessons.chapterId, courseChapters.id))
    .where(and(eq(courses.createdBy, session.user.id), eq(courses.isSystem, false)))
    .groupBy(courses.id)
    .orderBy(desc(courses.updatedAt))

  return NextResponse.json({ courses: rows })
}

// POST /api/courses — create empty course record (Pro, Teacher, Enterprise only)
export async function POST(req: NextRequest) {
  const session = await getSession()
  if (!session?.user?.id) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })
  if (!canCreateCourses(session.user.plan, session.user.internalRole)) {
    return NextResponse.json({ error: 'Courses require a Pro plan or higher' }, { status: 403 })
  }

  const { title, description, isPublic } = await req.json()
  if (!title?.trim()) return NextResponse.json({ error: 'title is required' }, { status: 400 })

  const baseSlug = slugify(title)
  const slug = `${baseSlug}-${Math.random().toString(36).slice(2, 7)}`

  const [course] = await db.insert(courses).values({
    title: title.trim(),
    slug,
    description: description?.trim() || null,
    isPublic: !!isPublic,
    createdBy: session.user.id,
  }).returning()

  return NextResponse.json({ course }, { status: 201 })
}

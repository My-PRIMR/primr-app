/**
 * System content immutability guards.
 *
 * System (built-in) lessons and courses cannot be mutated through the
 * normal API surface. The only allowed mutation is the system flag itself,
 * toggled by internal admins via primr-internal server actions.
 */
import { NextResponse } from 'next/server'

/** Returns a 403 response if the lesson is system, otherwise null. */
export function assertMutableLesson(lesson: { isSystem: boolean }) {
  if (lesson.isSystem) {
    return NextResponse.json(
      { error: 'System content is immutable. Demote it from System first.' },
      { status: 403 },
    )
  }
  return null
}

/** Returns a 403 response if the course is system, otherwise null. */
export function assertMutableCourse(course: { isSystem: boolean }) {
  if (course.isSystem) {
    return NextResponse.json(
      { error: 'System content is immutable. Demote it from System first.' },
      { status: 403 },
    )
  }
  return null
}

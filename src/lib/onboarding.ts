import { db } from '@/db'
import { onboardingPlaylists, lessonInvitations, users } from '@/db/schema'
import { eq } from 'drizzle-orm'

export type OnboardingSegment =
  | 'creator_free' | 'creator_pro' | 'creator_enterprise'
  | 'teacher' | 'lnd_manager' | 'org_admin'

export function resolveSegment(role: string, plan: string): OnboardingSegment | null {
  if (role === 'lnd_manager')  return 'lnd_manager'
  if (role === 'org_admin')    return 'org_admin'
  if (role === 'creator') {
    if (plan === 'teacher')    return 'teacher'
    if (plan === 'pro')        return 'creator_pro'
    if (plan === 'enterprise') return 'creator_enterprise'
    return 'creator_free'
  }
  return null
}

/**
 * Inserts lesson_invitations for any onboarding playlist lessons the user
 * doesn't already have. Skips duplicates via ON CONFLICT DO NOTHING.
 * Returns the count of new invitations created.
 */
export async function triggerOnboardingInvites(
  userId: string,
  email: string,
  segment: OnboardingSegment,
): Promise<number> {
  const playlist = await db
    .select({ lessonId: onboardingPlaylists.lessonId })
    .from(onboardingPlaylists)
    .where(eq(onboardingPlaylists.segment, segment))

  if (playlist.length === 0) return 0

  const lessonIds = playlist.map(r => r.lessonId)

  const result = await db
    .insert(lessonInvitations)
    .values(lessonIds.map(lessonId => ({
      lessonId,
      email: email.toLowerCase(),
      invitedBy: userId,
    })))
    .onConflictDoNothing()
    .returning({ id: lessonInvitations.id })

  return result.length
}

/**
 * Resets onboarding_dismissed_at for a user (called on plan upgrade so the
 * new segment's strip shows again).
 */
export async function resetOnboardingDismiss(userId: string): Promise<void> {
  await db
    .update(users)
    .set({ onboardingDismissedAt: null })
    .where(eq(users.id, userId))
}

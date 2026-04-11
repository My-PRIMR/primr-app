import { redirect } from 'next/navigation'
import { getSession } from '@/session'
import { db } from '@/db'
import { teamInvitations, organizations } from '@/db/schema'
import { and, eq } from 'drizzle-orm'
import { AcceptButton } from './AcceptButton'
import styles from './page.module.css'

export default async function AcceptInvitationPage({
  params,
}: {
  params: Promise<{ token: string }>
}) {
  const { token } = await params
  const session = await getSession()

  const invitation = await db.query.teamInvitations.findFirst({
    where: and(
      eq(teamInvitations.token, token),
      eq(teamInvitations.status, 'pending'),
    ),
  })

  if (!invitation || invitation.expiresAt < new Date()) {
    return (
      <main className={styles.main}>
        <section className={styles.card}>
          <h1 className={styles.title}>Invitation expired</h1>
          <p className={styles.body}>
            Ask your team admin to send a new one.
          </p>
        </section>
      </main>
    )
  }

  if (!session?.user?.id) {
    redirect(`/login?next=${encodeURIComponent(`/team/accept/${token}`)}`)
  }

  const org = await db.query.organizations.findFirst({
    where: eq(organizations.id, invitation.organizationId),
  })

  return (
    <main className={styles.main}>
      <section className={styles.card}>
        <h1 className={styles.title}>Join {org?.name ?? 'the team'}</h1>
        <p className={styles.body}>
          You&rsquo;ve been invited to join this team on Primr.
        </p>
        <AcceptButton token={token} />
      </section>
    </main>
  )
}

import { redirect } from 'next/navigation'
import { getSession } from '@/session'
import { db } from '@/db'
import {
  organizations,
  users,
  teamInvitations,
  planSubscriptions,
} from '@/db/schema'
import { and, eq } from 'drizzle-orm'
import { MembersList } from './MembersList'
import { InviteMemberForm } from './InviteMemberForm'
import styles from './page.module.css'

export default async function TeamPage() {
  const session = await getSession()
  if (!session?.user?.id) redirect('/login?next=/team')

  const user = await db.query.users.findFirst({
    where: eq(users.id, session.user.id),
  })
  if (!user?.organizationId) redirect('/upgrade')

  const org = await db.query.organizations.findFirst({
    where: eq(organizations.id, user.organizationId),
  })
  if (!org || org.ownerId !== session.user.id) redirect('/my-primr')

  const activeSub = await db.query.planSubscriptions.findFirst({
    where: and(
      eq(planSubscriptions.organizationId, org.id),
      eq(planSubscriptions.status, 'active'),
    ),
  })
  if (!activeSub) redirect('/upgrade')

  const members = await db.query.users.findMany({
    where: eq(users.organizationId, org.id),
  })
  const pendingInvites = await db.query.teamInvitations.findMany({
    where: and(
      eq(teamInvitations.organizationId, org.id),
      eq(teamInvitations.status, 'pending'),
    ),
  })

  const used = members.length + pendingInvites.length
  const canInvite = used < org.seatLimit

  return (
    <main className={styles.main}>
      <div className={styles.header}>
        <h1 className={styles.title}>{org.name}</h1>
        <p className={styles.meta}>
          {members.length} member{members.length === 1 ? '' : 's'} · {used} of {org.seatLimit} seats used
        </p>
      </div>

      <section className={styles.section}>
        <h2 className={styles.sectionHeading}>Members</h2>
        <MembersList
          members={members.map((m) => ({
            id: m.id,
            email: m.email,
            name: m.name,
            isOwner: m.id === org.ownerId,
          }))}
        />
      </section>

      <section className={styles.section}>
        <h2 className={styles.sectionHeading}>Invite</h2>
        <InviteMemberForm canInvite={canInvite} seatLimit={org.seatLimit} />
        {pendingInvites.length > 0 && (
          <ul className={styles.pendingList}>
            {pendingInvites.map((i) => (
              <li key={i.id}>
                <span>{i.email}</span>
                <span className={styles.muted}>pending</span>
              </li>
            ))}
          </ul>
        )}
      </section>
    </main>
  )
}

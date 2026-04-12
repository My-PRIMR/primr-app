import { redirect } from 'next/navigation'
import { getSession } from '@/session'
import { listTeacherRoster } from '@/lib/teacher-roster'
import StudentsTable from '../creator/students/StudentsTable'
import styles from '../creator/page.module.css'

export const dynamic = 'force-dynamic'

export default async function StudentsPage() {
  const session = await getSession()
  if (!session?.user?.id) redirect('/login')

  const role = session.user.productRole ?? 'learner'
  const plan = session.user.plan
  const isCreator = role === 'creator' || role === 'lnd_manager' || role === 'org_admin'
  const hasStudents = plan === 'teacher' || plan === 'pro' || plan === 'enterprise'

  if (!isCreator || !hasStudents) redirect('/creator')

  const roster = await listTeacherRoster(session.user.id)

  return (
    <main className={styles.main}>
      <div className={styles.content}>
        <StudentsTable roster={roster} />
      </div>
    </main>
  )
}

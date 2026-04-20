import { redirect } from 'next/navigation'
import { getSession } from '@/session'
import { fetchCreatorContent } from '../lib/fetchCreatorContent'
import CreatorDashboard from '../CreatorDashboard'
import { DashboardHeaderSlots } from '../DashboardHeaderSlots'
import styles from '../page.module.css'

export const dynamic = 'force-dynamic'

export default async function CoursesPage() {
  const session = await getSession()
  if (!session?.user?.id || !session.user.email) redirect('/login')

  const data = await fetchCreatorContent(
    session.user.id, session.user.email.toLowerCase(),
    session.user.productRole ?? 'learner', session.user.plan,
  )

  if (!data.isCreator) redirect('/learning')

  return (
    <main className={styles.main}>
      <DashboardHeaderSlots plan={data.plan} />
      <div className={styles.content}>
        <CreatorDashboard
          plan={data.plan}
          onboardingLessons={data.onboardingLessons}
          initialTab="courses"
          courses={data.createdCourses}
          lessons={data.createdLessons}
          isMonetized={data.isMonetized}
        />
      </div>
    </main>
  )
}

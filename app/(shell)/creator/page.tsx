import { redirect } from 'next/navigation'
import { getSession } from '@/session'
import { fetchCreatorContent } from './lib/fetchCreatorContent'
import { DashboardHeaderSlots } from './DashboardHeaderSlots'
import DashboardSummary from './DashboardSummary'
import ResultsTab from './ResultsTab'
import ResultsTabBoundary from './ResultsTabBoundary'
import styles from './page.module.css'

export const dynamic = 'force-dynamic'

export default async function CreatorDashboardPage() {
  const session = await getSession()
  if (!session?.user?.id || !session.user.email) redirect('/login')

  const role = session.user.productRole ?? 'learner'
  const isCreator = role === 'creator' || role === 'lnd_manager' || role === 'org_admin'

  if (!isCreator) redirect('/learning')

  const data = await fetchCreatorContent(
    session.user.id, session.user.email.toLowerCase(), role, session.user.plan,
  )

  return (
    <main className={styles.main}>
      <DashboardHeaderSlots plan={data.plan} />
      <div className={styles.content}>
        <DashboardSummary
          standaloneLessonCount={data.createdLessons.filter(l => l.isStandalone).length}
          courseCount={data.createdCourses.length}
          totalCourseLessons={data.createdCourses.reduce((sum, c) => sum + c.lessonCount, 0)}
          plan={data.plan}
        />
        {data.resultsData ? (
          <ResultsTabBoundary>
            <ResultsTab results={data.resultsData} />
          </ResultsTabBoundary>
        ) : (
          <p className={styles.empty}>Create your first lesson to start seeing results here.</p>
        )}
      </div>
    </main>
  )
}

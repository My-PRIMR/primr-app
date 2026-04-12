import { redirect } from 'next/navigation'
import { getSession } from '@/session'
import { fetchCreatorContent } from '../lib/fetchCreatorContent'
import CreatorDashboard from '../CreatorDashboard'
import styles from '../page.module.css'

export const dynamic = 'force-dynamic'

export default async function ResultsPage() {
  const session = await getSession()
  if (!session?.user?.id || !session.user.email) redirect('/login')

  const data = await fetchCreatorContent(
    session.user.id, session.user.email.toLowerCase(),
    session.user.productRole ?? 'learner', session.user.plan,
  )

  if (!data.isCreator) redirect('/learning')

  return (
    <main className={styles.main}>
      <div className={styles.content}>
        <CreatorDashboard
          plan={data.plan}
          onboardingLessons={data.onboardingLessons}
          results={data.resultsData}
          initialTab="results"
          courses={data.createdCourses}
          lessons={data.createdLessons}
        />
      </div>
    </main>
  )
}

import { getSession } from '@/session'
import { redirect } from 'next/navigation'
import CourseWizard from './CourseWizard'

export default async function NewCoursePage() {
  const session = await getSession()
  if (!session?.user?.id) redirect('/login')

  const role = session.user.productRole ?? 'learner'
  if (role !== 'creator' && role !== 'lnd_manager' && role !== 'org_admin') redirect('/creator')
  if (session.user.plan === 'free') redirect('/upgrade')

  return (
    <CourseWizard
      internalRole={session.user.internalRole ?? null}
      productRole={session.user.productRole ?? null}
    />
  )
}

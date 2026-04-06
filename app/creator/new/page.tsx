import { redirect } from 'next/navigation'
import { getSession } from '@/session'
import { toPageHeaderUser } from '../../components/pageHeaderUser'
import NewLessonWizard from './NewLessonWizard'

export default async function NewLessonPage() {
  const session = await getSession()
  if (!session?.user?.id) redirect('/login')

  return (
    <NewLessonWizard
      user={toPageHeaderUser(session.user)}
      internalRole={session.user.internalRole}
      productRole={session.user.productRole}
      plan={session.user.plan}
    />
  )
}

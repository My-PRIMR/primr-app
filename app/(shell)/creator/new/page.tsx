import { redirect } from 'next/navigation'
import { getSession } from '@/session'
import NewLessonWizard from './NewLessonWizard'

export default async function NewLessonPage() {
  const session = await getSession()
  if (!session?.user?.id) redirect('/login')

  return (
    <NewLessonWizard
      internalRole={session.user.internalRole}
      productRole={session.user.productRole}
      plan={session.user.plan}
    />
  )
}

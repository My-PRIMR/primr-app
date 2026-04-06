import { redirect } from 'next/navigation'
import { getSession } from '@/session'
import NewLessonWizard from './NewLessonWizard'

export default async function NewLessonPage() {
  const session = await getSession()
  if (!session?.user?.id) redirect('/login')

  return (
    <NewLessonWizard
      user={{
        name: session.user.name,
        email: session.user.email,
        productRole: session.user.productRole,
        internalRole: session.user.internalRole,
      }}
      internalRole={session.user.internalRole}
      productRole={session.user.productRole}
      plan={session.user.plan}
    />
  )
}

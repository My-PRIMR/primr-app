import { getSession } from '@/session'
import NewLessonWizard from './NewLessonWizard'

export default async function NewLessonPage() {
  const session = await getSession()
  return (
    <NewLessonWizard
      internalRole={session?.user?.internalRole ?? null}
      productRole={session?.user?.productRole ?? null}
      plan={session?.user?.plan ?? null}
    />
  )
}

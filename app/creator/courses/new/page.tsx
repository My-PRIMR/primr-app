import { getSession } from '@/session'
import { redirect } from 'next/navigation'
import CourseWizard from './CourseWizard'

export default async function NewCoursePage() {
  const session = await getSession()
  if (!session?.user?.id) redirect('/login')

  const role = session.user.role ?? 'learner'
  if (role !== 'creator' && role !== 'administrator') redirect('/creator')

  return <CourseWizard />
}

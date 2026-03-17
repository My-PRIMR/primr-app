import { auth } from '@/auth'
import { redirect } from 'next/navigation'
import CourseWizard from './CourseWizard'

export default async function NewCoursePage() {
  const session = await auth()
  if (!session?.user?.id) redirect('/login')

  const role = (session.user as { role?: string }).role ?? 'learner'
  if (role !== 'creator' && role !== 'administrator') redirect('/dashboard')

  return <CourseWizard />
}

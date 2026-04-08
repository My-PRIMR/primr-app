import { redirect } from 'next/navigation'
import { getSession } from '@/session'
import { PageHeader, type PageHeaderProps } from './PageHeader'
import { toPageHeaderUser } from './pageHeaderUser'

type Props = Omit<PageHeaderProps, 'user' | 'internalUrl'>

export default async function PageHeaderServer(props: Props) {
  const session = await getSession()
  if (!session?.user?.id) redirect('/login')

  return (
    <PageHeader
      user={toPageHeaderUser(session.user)}
      {...props}
    />
  )
}

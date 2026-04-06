import { redirect } from 'next/navigation'
import { getSession } from '@/session'
import { PageHeader, type PageHeaderProps } from './PageHeader'

type Props = Omit<PageHeaderProps, 'user' | 'internalUrl'>

export default async function PageHeaderServer(props: Props) {
  const session = await getSession()
  if (!session?.user?.id) redirect('/login')

  return (
    <PageHeader
      user={{
        name: session.user.name,
        email: session.user.email,
        productRole: session.user.productRole,
        internalRole: session.user.internalRole,
      }}
      internalUrl={process.env.PRIMR_INTERNAL_URL ?? 'http://localhost:3004'}
      {...props}
    />
  )
}

import { getSession } from '@/session'
import { AppShell } from '../components/shell/AppShell'
import type { ShellUser } from '../components/shell/shellTypes'

export default async function ShellLayout({ children }: { children: React.ReactNode }) {
  const session = await getSession()

  // No session: render children without shell.
  // Middleware handles redirects for protected routes;
  // public routes like /creator/[slug] pass through.
  if (!session?.user?.id) {
    return <>{children}</>
  }

  const user: ShellUser = {
    name: session.user.name,
    email: session.user.email,
    productRole: session.user.productRole,
    plan: session.user.plan,
    internalRole: session.user.internalRole,
    internalUrl: process.env.PRIMR_INTERNAL_URL ?? 'http://localhost:3004',
  }

  return <AppShell user={user}>{children}</AppShell>
}

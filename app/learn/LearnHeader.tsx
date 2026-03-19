import Link from 'next/link'
import { UserMenu } from '../components/UserMenu'
import styles from './LearnHeader.module.css'

interface LearnHeaderProps {
  userName: string | null
  userEmail: string
  role: string
  internalRole?: string | null
  internalUrl?: string
}

export default function LearnHeader({ userName, userEmail, role, internalRole, internalUrl }: LearnHeaderProps) {
  const dashboardHref = role === 'creator' || role === 'lnd_manager' || role === 'org_admin' ? '/creator' : '/my-primr'

  return (
    <header className={styles.header}>
      <Link href={dashboardHref} className={styles.wordmark}>Primr</Link>
      <UserMenu userName={userName} userEmail={userEmail} role={role} internalRole={internalRole} internalUrl={internalUrl} />
    </header>
  )
}

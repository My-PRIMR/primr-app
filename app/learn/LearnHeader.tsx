import Link from 'next/link'
import { UserMenu } from '../components/UserMenu'
import styles from './LearnHeader.module.css'

interface LearnHeaderProps {
  userName: string | null
  userEmail: string
  role: string
  plan?: string | null
  internalRole?: string | null
}

export default function LearnHeader({ userName, userEmail, role, plan, internalRole }: LearnHeaderProps) {
  const dashboardHref = role === 'creator' || role === 'lnd_manager' || role === 'org_admin' ? '/creator' : '/my-primr'
  const internalUrl = process.env.PRIMR_INTERNAL_URL ?? 'http://localhost:3004'

  return (
    <header className={styles.header}>
      <div className={styles.left}>
        <Link href={dashboardHref} className={styles.exitLink}>← Exit</Link>
        <Link href={dashboardHref} className={styles.wordmark}>Primr</Link>
      </div>
      <div className={styles.right}>
        <UserMenu userName={userName} userEmail={userEmail} role={role} plan={plan} internalRole={internalRole} internalUrl={internalUrl} />
      </div>
    </header>
  )
}

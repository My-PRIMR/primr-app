import Link from 'next/link'
import { UserMenu } from '../components/UserMenu'
import styles from './LearnHeader.module.css'

interface LearnHeaderProps {
  userName: string | null
  userEmail: string
  role: string
}

export default function LearnHeader({ userName, userEmail, role }: LearnHeaderProps) {
  const dashboardHref = role === 'creator' || role === 'administrator' ? '/creator' : '/my-primr'

  return (
    <header className={styles.header}>
      <Link href={dashboardHref} className={styles.wordmark}>Primr</Link>
      <UserMenu userName={userName} userEmail={userEmail} role={role} />
    </header>
  )
}

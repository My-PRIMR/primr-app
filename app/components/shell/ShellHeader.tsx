'use client'

import Link from 'next/link'
import type { ShellUser } from './shellTypes'
import { useShellHeader } from './ShellHeaderContext'
import { ShellUserMenu } from './ShellUserMenu'
import styles from './ShellHeader.module.css'

function homeHref(role: string): string {
  if (role === 'creator' || role === 'lnd_manager' || role === 'org_admin') return '/creator'
  return '/my-primr'
}

interface ShellHeaderProps {
  user: ShellUser
  collapsed: boolean
  onToggleSidebar: () => void
}

export function ShellHeader({ user, collapsed, onToggleSidebar }: ShellHeaderProps) {
  const { leftSlot, rightSlot } = useShellHeader()

  return (
    <header className={styles.header}>
      <button
        className={styles.hamburger}
        onClick={onToggleSidebar}
        aria-label={collapsed ? 'Open navigation' : 'Close navigation'}
        aria-expanded={!collapsed}
      >
        <span className={styles.hamburgerBar} />
        <span className={styles.hamburgerBar} />
        <span className={styles.hamburgerBar} />
      </button>

      <Link href={homeHref(user.productRole)} className={styles.wordmark}>Primr</Link>

      {leftSlot && <div className={styles.leftSlot}>{leftSlot}</div>}
      <div className={styles.spacer} />
      {rightSlot && <div className={styles.rightSlot}>{rightSlot}</div>}

      <ShellUserMenu user={user} />
    </header>
  )
}

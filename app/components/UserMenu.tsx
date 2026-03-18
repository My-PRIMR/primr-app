'use client'

import { useState, useRef, useEffect } from 'react'
import styles from './UserMenu.module.css'
import { UpgradeModal } from './UpgradeModal'

interface UserMenuProps {
  userName: string | null
  userEmail: string
  role: string
}

function roleLabel(role: string) {
  switch (role) {
    case 'creator':     return 'Creator'
    case 'lnd_manager': return 'L&D Manager'
    case 'org_admin':   return 'Org Admin'
    case 'learner':     return 'Learner'
    default:            return role
  }
}

export function UserMenu({ userName, userEmail, role }: UserMenuProps) {
  const [open, setOpen] = useState(false)
  const [showUpgrade, setShowUpgrade] = useState(false)
  const ref = useRef<HTMLDivElement>(null)
  const initial = (userName ?? userEmail).charAt(0).toUpperCase()
  const displayName = userName || userEmail

  useEffect(() => {
    if (!open) return
    function handleClick(e: MouseEvent) {
      if (ref.current && !ref.current.contains(e.target as Node)) setOpen(false)
    }
    document.addEventListener('mousedown', handleClick)
    return () => document.removeEventListener('mousedown', handleClick)
  }, [open])

  return (
    <>
    {showUpgrade && <UpgradeModal onClose={() => setShowUpgrade(false)} />}
    <div className={styles.wrapper} ref={ref}>
      <button
        className={styles.avatar}
        onClick={() => setOpen(o => !o)}
        aria-label="Account menu"
        aria-expanded={open}
      >
        {initial}
      </button>

      {open && (
        <div className={styles.dropdown}>
          {/* Identity */}
          <div className={styles.identity}>
            <span className={styles.name}>{displayName}</span>
            <span className={styles.roleBadge}>{roleLabel(role)}</span>
          </div>

          <div className={styles.divider} />

          {/* Become a creator — learners only */}
          {role === 'learner' && (
            <>
              <button
                className={styles.upgradeItem}
                onClick={() => { setOpen(false); setShowUpgrade(true) }}
              >
                <span className={styles.upgradeIcon}>✦</span>
                <span>
                  <span className={styles.upgradeTitle}>Become a Creator</span>
                  <span className={styles.upgradeSub}>It&apos;s free!</span>
                </span>
              </button>
              <div className={styles.divider} />
            </>
          )}

          {/* Logout */}
          <a href="/api/auth/logout" className={styles.logoutItem}>
            Log out
          </a>
        </div>
      )}
    </div>
    </>
  )
}

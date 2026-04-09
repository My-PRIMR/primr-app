'use client'

import { useState, useRef, useEffect } from 'react'
import { createPortal } from 'react-dom'
import styles from './UserMenu.module.css'
import { UpgradeModal } from './UpgradeModal'
import { TeacherModal } from './TeacherModal'
import { useTheme } from './useTheme'
import type { Theme } from './useTheme'

interface UserMenuProps {
  userName: string | null
  userEmail: string
  role: string
  internalRole?: string | null
  internalUrl?: string
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

export function UserMenu({ userName, userEmail, role, internalRole, internalUrl }: UserMenuProps) {
  const [open, setOpen] = useState(false)
  const [showUpgrade, setShowUpgrade] = useState(false)
  const [showTeacher, setShowTeacher] = useState(false)
  const [dropdownPos, setDropdownPos] = useState({ top: 0, right: 0 })
  const { theme, setTheme } = useTheme()
  const wrapperRef = useRef<HTMLDivElement>(null)
  const btnRef = useRef<HTMLButtonElement>(null)
  const dropdownRef = useRef<HTMLDivElement>(null)
  const initial = (userName ?? userEmail).charAt(0).toUpperCase()
  const displayName = userName || userEmail

  useEffect(() => {
    if (!open) return
    function handleClick(e: MouseEvent) {
      const target = e.target as Node
      if (
        wrapperRef.current && !wrapperRef.current.contains(target) &&
        dropdownRef.current && !dropdownRef.current.contains(target)
      ) setOpen(false)
    }
    document.addEventListener('mousedown', handleClick)
    return () => document.removeEventListener('mousedown', handleClick)
  }, [open])

  function handleOpen() {
    if (btnRef.current) {
      const rect = btnRef.current.getBoundingClientRect()
      setDropdownPos({
        top: rect.bottom + 10,
        right: window.innerWidth - rect.right,
      })
    }
    setOpen(o => !o)
  }

  const dropdownContent = (
    <div
      ref={dropdownRef}
      className={styles.dropdown}
      style={{ position: 'fixed', top: dropdownPos.top, right: dropdownPos.right }}
    >
      {/* Identity */}
      <div className={styles.identity}>
        <span className={styles.name}>{displayName}</span>
        <span className={styles.roleBadge}>{roleLabel(role)}</span>
      </div>

      <div className={styles.divider} />

      {/* Upgrade options — learners and free creators */}
      {(role === 'learner' || role === 'creator') && (
        <>
          {role === 'learner' && (
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
          )}
          <button
            className={styles.upgradeItem}
            onClick={() => { setOpen(false); setShowTeacher(true) }}
          >
            <span className={styles.upgradeIcon}>🎓</span>
            <span>
              <span className={styles.upgradeTitle}>Apply for Teacher</span>
              <span className={styles.upgradeSub}>Free for K-12 educators</span>
            </span>
          </button>
          <div className={styles.divider} />
        </>
      )}

      {/* Primr Internal — staff and admin only */}
      {(internalRole === 'staff' || internalRole === 'admin') && (
        <>
          <a href={internalUrl} className={styles.internalItem}>
            Primr Internal ↗
          </a>
          <div className={styles.divider} />
        </>
      )}

      {/* Documentation */}
      <a href="/docs" className={styles.docItem} onClick={() => setOpen(false)}>
        Documentation
      </a>

      <div className={styles.divider} />

      {/* Theme toggle */}
      <div className={styles.themeRow}>
        {(['light', 'system', 'dark'] as Theme[]).map(t => (
          <button
            key={t}
            className={`${styles.themeBtn} ${theme === t ? styles.themeBtnActive : ''}`}
            onClick={() => setTheme(t)}
            title={t.charAt(0).toUpperCase() + t.slice(1)}
          >
            {t === 'light' ? '☀' : t === 'dark' ? '☾' : '⊙'}
          </button>
        ))}
      </div>

      <div className={styles.divider} />

      {/* Logout */}
      <a href="/api/auth/logout" className={styles.logoutItem}>
        Log out
      </a>
    </div>
  )

  return (
    <>
      {showUpgrade && <UpgradeModal onClose={() => setShowUpgrade(false)} />}
      {showTeacher && <TeacherModal onClose={() => setShowTeacher(false)} />}
      <div className={styles.wrapper} ref={wrapperRef}>
        <button
          ref={btnRef}
          className={styles.avatar}
          onClick={handleOpen}
          aria-label="Account menu"
          aria-expanded={open}
        >
          {initial}
        </button>

        {open && createPortal(dropdownContent, document.body)}
      </div>
    </>
  )
}

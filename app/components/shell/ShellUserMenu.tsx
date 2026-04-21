'use client'

import { useState, useRef, useEffect } from 'react'
import { createPortal } from 'react-dom'
import type { ShellUser } from './shellTypes'
import styles from './ShellUserMenu.module.css'

function roleLabel(role: string, plan?: string | null) {
  switch (role) {
    case 'creator':     return plan === 'pro' || plan === 'enterprise' ? 'Creator Pro' : 'Creator'
    case 'lnd_manager': return 'L&D Manager'
    case 'org_admin':   return 'Org Admin'
    case 'learner':     return 'Learner'
    default:            return role
  }
}

export function ShellUserMenu({ user }: { user: ShellUser }) {
  const [open, setOpen] = useState(false)
  const [dropdownPos, setDropdownPos] = useState({ top: 0, right: 0 })
  const wrapperRef = useRef<HTMLDivElement>(null)
  const btnRef = useRef<HTMLButtonElement>(null)
  const dropdownRef = useRef<HTMLDivElement>(null)
  const initial = (user.name ?? user.email).charAt(0).toUpperCase()
  const displayName = user.name || user.email

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
        <span className={styles.roleBadge}>{roleLabel(user.productRole, user.plan)}</span>
      </div>

      <div className={styles.divider} />

      {/* Primr Internal — staff and admin only */}
      {(user.internalRole === 'staff' || user.internalRole === 'admin') && (
        <>
          <a href={user.internalUrl} className={styles.linkItem}>
            Primr Internal ↗
          </a>
          <div className={styles.divider} />
        </>
      )}

      {/* Documentation */}
      <a href="/docs" className={styles.linkItem} onClick={() => setOpen(false)}>
        Documentation
      </a>

      <div className={styles.divider} />

      {/* Logout */}
      <a href="/api/auth/logout" className={styles.logoutItem}>
        Log out
      </a>
    </div>
  )

  return (
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
  )
}

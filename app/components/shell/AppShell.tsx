'use client'

import { useState, useEffect, type ReactNode } from 'react'
import type { ShellUser } from './shellTypes'
import { ShellHeaderProvider } from './ShellHeaderContext'
import { ShellHeader } from './ShellHeader'
import { SideNav } from './SideNav'
import styles from './AppShell.module.css'

const STORAGE_KEY = 'primr_sidenav_collapsed'

export function AppShell({ user, children }: { user: ShellUser; children: ReactNode }) {
  const [collapsed, setCollapsed] = useState(true)

  useEffect(() => {
    const stored = localStorage.getItem(STORAGE_KEY)
    if (stored === 'false') setCollapsed(false)
  }, [])

  function toggleCollapsed() {
    setCollapsed(prev => {
      const next = !prev
      localStorage.setItem(STORAGE_KEY, String(next))
      return next
    })
  }

  return (
    <ShellHeaderProvider>
      <div className={styles.shell}>
        <ShellHeader user={user} collapsed={collapsed} onToggleSidebar={toggleCollapsed} />
        <div className={styles.body}>
          <SideNav user={user} collapsed={collapsed} onToggle={toggleCollapsed} />
          {!collapsed && (
            <div
              className={styles.mobileBackdrop}
              onClick={toggleCollapsed}
            />
          )}
          <main className={styles.content}>
            {children}
          </main>
        </div>
      </div>
    </ShellHeaderProvider>
  )
}

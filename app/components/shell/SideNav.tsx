'use client'

import type { ShellUser } from './shellTypes'
import { SideNavItem } from './SideNavItem'
import { resolveNavItems } from './resolveNav'
import styles from './SideNav.module.css'

interface SideNavProps {
  user: ShellUser
  collapsed: boolean
  onToggle: () => void
}

export function SideNav({ user, collapsed, onToggle }: SideNavProps) {
  const items = resolveNavItems(user)

  return (
    <nav
      className={`${styles.nav} ${collapsed ? styles.navCollapsed : ''}`}
      aria-label="Main navigation"
    >
      <div className={styles.items}>
        {items.map(item => (
          <SideNavItem key={item.id} item={item} collapsed={collapsed} />
        ))}
      </div>

      <button
        className={styles.collapseBtn}
        onClick={onToggle}
        title={collapsed ? 'Expand sidebar' : 'Collapse sidebar'}
        aria-label={collapsed ? 'Expand sidebar' : 'Collapse sidebar'}
      >
        {collapsed ? '▶' : '◀'}
      </button>
    </nav>
  )
}

'use client'

import { useState } from 'react'
import type { ShellUser } from './shellTypes'
import { SideNavItem } from './SideNavItem'
import { resolveNavItems } from './resolveNav'
import { UpgradeModal } from '../UpgradeModal'
import styles from './SideNav.module.css'

interface SideNavProps {
  user: ShellUser
  collapsed: boolean
  onToggle: () => void
}

export function SideNav({ user, collapsed, onToggle }: SideNavProps) {
  const [showUpgrade, setShowUpgrade] = useState(false)
  const isLearner = user.productRole === 'learner'

  const items = resolveNavItems(user).map(item => {
    if (item.kind === 'upgrade' && isLearner) {
      return { ...item, href: undefined, onClick: () => setShowUpgrade(true) }
    }
    return item
  })

  return (
    <>
      {showUpgrade && <UpgradeModal onClose={() => setShowUpgrade(false)} />}
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
    </>
  )
}

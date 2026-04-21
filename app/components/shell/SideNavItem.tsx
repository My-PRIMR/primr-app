'use client'

import Link from 'next/link'
import { useState } from 'react'
import { usePathname } from 'next/navigation'
import styles from './SideNavItem.module.css'

export interface NavChild {
  label: string
  href: string
  badge?: string
}

export interface NavItemConfig {
  id: string
  label: string
  icon: string
  href?: string
  kind?: string
  children?: NavChild[]
  badge?: string
  /** Custom widget rendered below children (e.g. theme toggle) */
  widget?: React.ReactNode
  onClick?: () => void
}

interface SideNavItemProps {
  item: NavItemConfig
  collapsed: boolean
}

function isActive(href: string, pathname: string): boolean {
  return pathname === href || pathname.startsWith(href + '/')
}

export function SideNavItem({ item, collapsed }: SideNavItemProps) {
  const pathname = usePathname()
  const [expanded, setExpanded] = useState(false)

  const hasChildren = (item.children && item.children.length > 0) || item.widget

  // Check if this item or any child is active
  const selfActive = item.href ? pathname === item.href : false
  const anyChildActive = item.children?.some(c => isActive(c.href, pathname)) ?? false
  const active = selfActive || anyChildActive

  // Auto-expand if a child is active
  const showChildren = (expanded || anyChildActive) && !collapsed

  function handleClick() {
    if (item.onClick) {
      item.onClick()
      return
    }
    if (hasChildren) {
      setExpanded(v => !v)
    }
  }

  const content = (
    <>
      <span className={styles.icon}>{item.icon}</span>
      {!collapsed && (
        <>
          <span className={styles.label}>{item.label}</span>
          {item.badge && <span className={styles.badge}>{item.badge}</span>}
          {hasChildren && (
            <span className={`${styles.chevron} ${showChildren ? '' : styles.chevronCollapsed}`}>▾</span>
          )}
        </>
      )}
    </>
  )

  return (
    <div className={styles.root}>
      {/* Main item — link if has href, button otherwise */}
      {item.href ? (
        <Link
          href={item.href}
          className={`${styles.item} ${active ? styles.itemActive : ''} ${collapsed ? styles.itemCollapsed : ''}`}
          title={collapsed ? item.label : undefined}
          onClick={hasChildren ? () => setExpanded(true) : undefined}
        >
          {content}
        </Link>
      ) : (
        <button
          className={`${styles.item} ${active ? styles.itemActive : ''} ${collapsed ? styles.itemCollapsed : ''}`}
          onClick={handleClick}
          title={collapsed ? item.label : undefined}
        >
          {content}
        </button>
      )}

      {/* Children */}
      {showChildren && (
        <div className={styles.children}>
          {item.children?.map(child => {
            const childActive = isActive(child.href, pathname)
            return (
              <Link
                key={child.href}
                href={child.href}
                className={`${styles.child} ${childActive ? styles.childActive : ''}`}
              >
                <span className={styles.childLabel}>{child.label}</span>
                {child.badge && <span className={styles.badge}>{child.badge}</span>}
              </Link>
            )
          })}
          {item.widget}
        </div>
      )}
    </div>
  )
}

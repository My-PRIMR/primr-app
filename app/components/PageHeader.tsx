'use client'

import Link from 'next/link'
import type { ReactNode } from 'react'
import { UserMenu } from './UserMenu'
import { type PageHeaderUser } from './pageHeaderUser'
import styles from './PageHeader.module.css'

export type { PageHeaderUser }

export interface PageHeaderProps {
  user: PageHeaderUser
  internalUrl?: string
  title?: string
  leftSlot?: ReactNode
  rightSlot?: ReactNode
  homeHref?: string
}

function defaultHomeHref(role: string): string {
  if (role === 'creator' || role === 'lnd_manager' || role === 'org_admin') return '/creator'
  return '/my-primr'
}

export function PageHeader({
  user,
  internalUrl,
  title,
  leftSlot,
  rightSlot,
  homeHref,
}: PageHeaderProps) {
  const href = homeHref ?? defaultHomeHref(user.productRole)

  return (
    <header className={styles.header}>
      <Link href={href} className={styles.wordmark}>Primr</Link>
      {title && <span className={styles.title}>{title}</span>}
      {leftSlot && <div className={styles.leftSlot}>{leftSlot}</div>}
      <div className={styles.spacer} />
      {rightSlot && <div className={styles.rightSlot}>{rightSlot}</div>}
      <div className={styles.right}>
        <UserMenu
          userName={user.name}
          userEmail={user.email}
          role={user.productRole}
          internalRole={user.internalRole}
          internalUrl={internalUrl}
        />
      </div>
    </header>
  )
}

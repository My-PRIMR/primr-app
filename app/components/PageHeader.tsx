'use client'

import Link from 'next/link'
import type { ReactNode } from 'react'
import { UserMenu } from './UserMenu'
import { ThemeToggle } from './ThemeToggle'
import styles from './PageHeader.module.css'

export interface PageHeaderUser {
  name: string | null
  email: string
  productRole: string
  internalRole?: string | null
}

/** Picks the fields PageHeader needs from a PrimrSession user. */
export function toPageHeaderUser(user: {
  name: string | null
  email: string
  productRole: string
  internalRole: string | null
}): PageHeaderUser {
  return {
    name: user.name,
    email: user.email,
    productRole: user.productRole,
    internalRole: user.internalRole,
  }
}

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
        <ThemeToggle />
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

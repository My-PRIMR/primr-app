'use client'

import Link from 'next/link'
import { ShellHeaderSlots } from '../../components/shell/ShellHeaderSlots'
import styles from './page.module.css'

export function DashboardHeaderSlots({ plan }: { plan: string }) {
  return (
    <ShellHeaderSlots
      right={
        <>
          {plan !== 'free' && <Link href="/creator/courses/new" className={styles.newCourseBtn}>+ New course</Link>}
          <Link href="/creator/new" className={styles.newBtn}>+ New lesson</Link>
        </>
      }
    />
  )
}

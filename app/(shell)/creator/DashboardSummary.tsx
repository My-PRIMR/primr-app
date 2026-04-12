'use client'

import Link from 'next/link'
import styles from './DashboardSummary.module.css'

interface Props {
  standaloneLessonCount: number
  courseCount: number
  totalCourseLessons: number
  plan: string
}

export default function DashboardSummary({ standaloneLessonCount, courseCount, totalCourseLessons, plan }: Props) {
  return (
    <div className={styles.grid}>
      <Link href="/creator/lessons" className={styles.card}>
        <div className={styles.cardIcon}>◈</div>
        <div className={styles.cardBody}>
          <div className={styles.cardValue}>{standaloneLessonCount}</div>
          <div className={styles.cardLabel}>Standalone lesson{standaloneLessonCount !== 1 ? 's' : ''}</div>
        </div>
        <span className={styles.cardArrow}>→</span>
      </Link>
      <Link href={plan === 'free' ? '/upgrade' : '/creator/courses'} className={styles.card}>
        <div className={styles.cardIcon}>⊞</div>
        <div className={styles.cardBody}>
          <div className={styles.cardValue}>{courseCount}</div>
          <div className={styles.cardLabel}>Course{courseCount !== 1 ? 's' : ''} · {totalCourseLessons} lesson{totalCourseLessons !== 1 ? 's' : ''}</div>
        </div>
        <span className={styles.cardArrow}>→</span>
      </Link>
    </div>
  )
}

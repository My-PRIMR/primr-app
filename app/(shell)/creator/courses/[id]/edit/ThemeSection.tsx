'use client'

import { THEMES } from '@/lib/themes'
import styles from './PricingSection.module.css'

interface Props {
  courseId: string
  currentTheme: string
}

export function ThemeSection({ courseId, currentTheme }: Props) {
  const theme = THEMES.find((t) => t.id === currentTheme)
  const themeName = theme?.name ?? currentTheme

  function openPreview() {
    window.open(
      `/creator/embed-preview/course/${courseId}`,
      'primr-embed-preview',
      'width=1100,height=800,menubar=no,toolbar=no',
    )
  }

  return (
    <section className={styles.section}>
      <p className={styles.heading}>Theme</p>
      <p className={styles.hint}>
        Current: <strong>{themeName}</strong>
        {theme && theme.tier !== 'free' ? ` (${theme.tier})` : ''}
      </p>
      <div className={styles.actions}>
        <button className={styles.saveBtn} onClick={openPreview}>
          Preview / change
        </button>
      </div>
    </section>
  )
}

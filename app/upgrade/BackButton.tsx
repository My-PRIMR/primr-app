'use client'

import { useRouter } from 'next/navigation'
import styles from './page.module.css'

export function BackButton() {
  const router = useRouter()
  return (
    <button className={styles.backButton} onClick={() => router.back()}>
      ← Back
    </button>
  )
}

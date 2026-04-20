'use client'

import { useState, useEffect } from 'react'
import { UpgradeModal } from './UpgradeModal'
import styles from '../(shell)/creator/page.module.css'

const STORAGE_KEY = 'primr.hideCreatorCta'

export function UpgradeCTA() {
  const [showModal, setShowModal] = useState(false)
  const [hidden, setHidden] = useState<boolean | null>(null)

  useEffect(() => {
    // eslint-disable-next-line react-hooks/set-state-in-effect
    setHidden(window.localStorage.getItem(STORAGE_KEY) === '1')
  }, [])

  function dismiss() {
    window.localStorage.setItem(STORAGE_KEY, '1')
    setHidden(true)
  }

  if (hidden === null || hidden) return null

  return (
    <>
      {showModal && <UpgradeModal onClose={() => setShowModal(false)} />}
      <div className={styles.creatorCta}>
        <p className={styles.creatorCtaText}>
          Want to create and share your own lessons?
        </p>
        <button className={styles.creatorCtaLink} onClick={() => setShowModal(true)}>
          Become a Primr Creator — it&apos;s free!
        </button>
        <button
          type="button"
          className={styles.creatorCtaDismiss}
          onClick={dismiss}
        >
          Don&apos;t show again
        </button>
      </div>
    </>
  )
}

'use client'

import { useState } from 'react'
import { UpgradeModal } from './UpgradeModal'
import styles from '../creator/page.module.css'

export function UpgradeCTA() {
  const [showModal, setShowModal] = useState(false)

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
      </div>
    </>
  )
}

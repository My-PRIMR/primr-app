'use client'

import { useState } from 'react'
import { UpgradeModal } from '../../../components/UpgradeModal'
import styles from './page.module.css'

export function BecomeCreatorButton() {
  const [open, setOpen] = useState(false)

  return (
    <>
      {open && <UpgradeModal onClose={() => setOpen(false)} />}
      <button
        type="button"
        className={styles.primaryBtn}
        onClick={() => setOpen(true)}
      >
        Become a Creator — free
      </button>
    </>
  )
}

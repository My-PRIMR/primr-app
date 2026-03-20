'use client'

import { useState } from 'react'
import { useRouter } from 'next/navigation'
import styles from './page.module.css'

interface DeleteItemButtonProps {
  kind: 'lesson' | 'course'
  id: string
}

export function DeleteItemButton({ kind, id }: DeleteItemButtonProps) {
  const router = useRouter()
  const [busy, setBusy] = useState(false)

  async function onDelete() {
    if (busy) return
    const noun = kind === 'course' ? 'course' : 'lesson'
    const ok = window.confirm(
      `Delete this ${noun}? This action cannot be undone.`
    )
    if (!ok) return

    setBusy(true)
    try {
      const res = await fetch(`/api/${kind === 'course' ? 'courses' : 'lessons'}/${id}`, {
        method: 'DELETE',
      })
      if (!res.ok) {
        const data = await res.json().catch(() => ({}))
        throw new Error(data.error || `Failed to delete ${noun}.`)
      }
      router.refresh()
    } catch (err) {
      const message = err instanceof Error ? err.message : `Failed to delete ${noun}.`
      window.alert(message)
    } finally {
      setBusy(false)
    }
  }

  return (
    <button
      type="button"
      className={styles.deleteBtn}
      onClick={onDelete}
      disabled={busy}
    >
      {busy ? 'Deleting…' : 'Delete'}
    </button>
  )
}

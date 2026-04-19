'use client'

import { useState, useEffect } from 'react'
import styles from './InviteModal.module.css'

interface Invitee {
  id: string
  email: string
}

interface Props {
  type: 'lesson' | 'course'
  id: string
  title: string
  isPaid: boolean
  onClose: () => void
}

export default function InviteModal({ type, id, title, isPaid, onClose }: Props) {
  const [emailInput, setEmailInput] = useState('')
  const [invitees, setInvitees] = useState<Invitee[]>([])
  const [loading, setLoading] = useState(true)
  const [inviting, setInviting] = useState(false)
  const [inviteError, setInviteError] = useState('')
  const [copied, setCopied] = useState(false)

  const apiBase = type === 'lesson' ? `/api/lessons/${id}/invite` : `/api/courses/${id}/enroll`
  const linkApi = type === 'lesson' ? `/api/lessons/${id}/invite-link` : `/api/courses/${id}/invite-link`
  const inviteRoute = type === 'lesson' ? 'api/invite' : 'api/course-invite'

  useEffect(() => {
    if (isPaid) {
      setLoading(false)
      return
    }
    setLoading(true)
    fetch(apiBase)
      .then(r => r.json())
      .then(data => {
        const list: Invitee[] = type === 'lesson'
          ? (data.invitations ?? [])
          : (data.enrollments ?? [])
        setInvitees(list)
      })
      .finally(() => setLoading(false))
  }, [apiBase, type, isPaid])

  useEffect(() => {
    function handleKeyDown(e: KeyboardEvent) {
      if (e.key === 'Escape') onClose()
    }
    document.addEventListener('keydown', handleKeyDown)
    return () => document.removeEventListener('keydown', handleKeyDown)
  }, [onClose])

  async function handleInvite() {
    const emails = emailInput.split(/[,\n\s]+/).map(e => e.trim()).filter(Boolean)
    if (emails.length === 0) return
    setInviting(true)
    setInviteError('')

    if (type === 'lesson') {
      const res = await fetch(apiBase, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ emails }),
      })
      if (!res.ok) {
        const data = await res.json().catch(() => ({}))
        setInviteError(data.error ?? 'Failed to invite.')
        setInviting(false)
        return
      }
    } else {
      for (const email of emails) {
        await fetch(apiBase, {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({ email }),
        })
      }
    }

    const data = await fetch(apiBase).then(r => r.json())
    const list: Invitee[] = type === 'lesson' ? (data.invitations ?? []) : (data.enrollments ?? [])
    setInvitees(list)
    setEmailInput('')
    setInviting(false)
  }

  async function handleRemove(email: string) {
    await fetch(apiBase, {
      method: 'DELETE',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ email }),
    })
    setInvitees(prev => prev.filter(i => i.email !== email))
  }

  async function handleCopyLink() {
    const data = await fetch(linkApi, { method: 'POST' }).then(r => r.json())
    const url = `${window.location.origin}/${inviteRoute}/${data.token}`
    await navigator.clipboard.writeText(url)
    setCopied(true)
    setTimeout(() => setCopied(false), 2000)
  }

  return (
    <div className={styles.overlay} onClick={onClose}>
      <div className={styles.modal} onClick={e => e.stopPropagation()}>
        <div className={styles.header}>
          <h2 className={styles.title}>Invite learners: {title}</h2>
          <button className={styles.closeBtn} onClick={onClose} aria-label="Close">&times;</button>
        </div>

        {!isPaid && (
          <>
            <div className={styles.inputRow}>
              <input
                className={styles.input}
                type="text"
                placeholder="email@example.com, another@..."
                value={emailInput}
                onChange={e => setEmailInput(e.target.value)}
                onKeyDown={e => {
                  if (e.key === 'Enter') {
                    e.preventDefault()
                    handleInvite()
                  }
                }}
                autoFocus
              />
              <button
                className={styles.inviteBtn}
                onClick={handleInvite}
                disabled={inviting || !emailInput.trim()}
              >
                {inviting ? 'Adding…' : 'Add'}
              </button>
            </div>
            {inviteError && <p className={styles.error}>{inviteError}</p>}
          </>
        )}

        <button className={styles.linkBtn} onClick={handleCopyLink}>
          <LinkIcon />
          {copied ? 'Copied!' : 'Copy invite link'}
        </button>

        {isPaid && (
          <p className={styles.hint}>
            This {type} is paid. Share the invite link directly — email
            invitations are disabled for paid content.
          </p>
        )}

        {!isPaid && (
          loading ? (
            <p className={styles.empty}>Loading…</p>
          ) : invitees.length > 0 ? (
            <ul className={styles.list}>
              {invitees.map(i => (
                <li key={i.id} className={styles.listItem}>
                  <span className={styles.email}>{i.email}</span>
                  <button className={styles.removeBtn} onClick={() => handleRemove(i.email)}>
                    Remove
                  </button>
                </li>
              ))}
            </ul>
          ) : (
            <p className={styles.empty}>No one invited yet.</p>
          )
        )}
      </div>
    </div>
  )
}

function LinkIcon() {
  return (
    <svg
      width="13"
      height="13"
      viewBox="0 0 24 24"
      fill="none"
      stroke="currentColor"
      strokeWidth="2.2"
      strokeLinecap="round"
      strokeLinejoin="round"
    >
      <path d="M10 13a5 5 0 0 0 7.54.54l3-3a5 5 0 0 0-7.07-7.07l-1.72 1.71" />
      <path d="M14 11a5 5 0 0 0-7.54-.54l-3 3a5 5 0 0 0 7.07 7.07l1.71-1.71" />
    </svg>
  )
}

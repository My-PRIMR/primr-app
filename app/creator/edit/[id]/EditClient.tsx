'use client'

import { useState, useEffect, useCallback } from 'react'
import Link from 'next/link'
import type { LessonManifest } from '@/types/outline'
import LessonBlockEditor from '../../components/LessonBlockEditor'
import { PageHeader } from '../../../components/PageHeader'
import { type PageHeaderUser } from '../../../components/pageHeaderUser'
import styles from './EditClient.module.css'
import { canUsePexels, canAiEdit as canAiEditFn } from '@/lib/models'

export default function EditClient({
  lessonId,
  manifest,
  publishedAt,
  plan,
  internalRole,
  user,
}: {
  lessonId: string
  manifest: LessonManifest
  publishedAt: string | null
  plan: string
  internalRole: string | null
  user: PageHeaderUser
}) {
  const canPexels = canUsePexels(plan, internalRole)
  const aiEditEnabled = canAiEditFn(plan, internalRole)
  const [inviteEmails, setInviteEmails] = useState('')
  const [invitedList, setInvitedList] = useState<{ id: string; email: string }[]>([])
  const [inviteLink, setInviteLink] = useState<string | null>(null)
  const [inviting, setInviting] = useState(false)
  const [linkCopied, setLinkCopied] = useState(false)

  const loadInvitations = useCallback(async () => {
    const res = await fetch(`/api/lessons/${lessonId}/invite`)
    if (res.ok) {
      const data = await res.json()
      setInvitedList(data.invitations)
    }
  }, [lessonId])

  useEffect(() => { loadInvitations() }, [loadInvitations])

  async function sendInvites() {
    const emails = inviteEmails.split(',').map(e => e.trim()).filter(Boolean)
    if (emails.length === 0) return
    setInviting(true)
    await fetch(`/api/lessons/${lessonId}/invite`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ emails }),
    })
    setInviteEmails('')
    setInviting(false)
    loadInvitations()
  }

  async function removeInvite(email: string) {
    await fetch(`/api/lessons/${lessonId}/invite`, {
      method: 'DELETE',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ email }),
    })
    loadInvitations()
  }

  async function copyInviteLink() {
    let token = inviteLink
    if (!token) {
      const res = await fetch(`/api/lessons/${lessonId}/invite-link`, { method: 'POST' })
      if (!res.ok) return
      const data = await res.json()
      token = data.token
      setInviteLink(token)
    }
    await navigator.clipboard.writeText(`${window.location.origin}/api/invite/${token}`)
    setLinkCopied(true)
    setTimeout(() => setLinkCopied(false), 2000)
  }

  const sharePanel = (
    <div className={styles.shareSection}>
      <p className={styles.shareHeading}>Share lesson</p>
      <div className={styles.shareRow}>
        <input
          className={styles.shareInput}
          placeholder="email1@example.com, email2@example.com"
          value={inviteEmails}
          onChange={e => setInviteEmails(e.target.value)}
          onKeyDown={e => e.key === 'Enter' && sendInvites()}
        />
        <button className={styles.shareBtn} onClick={sendInvites} disabled={inviting}>
          {inviting ? '…' : 'Invite'}
        </button>
      </div>
      {invitedList.length > 0 && (
        <ul className={styles.invitedList}>
          {invitedList.map(inv => (
            <li key={inv.id} className={styles.invitedItem}>
              <span>{inv.email}</span>
              <button className={styles.removeBtn} onClick={() => removeInvite(inv.email)}>Remove</button>
            </li>
          ))}
        </ul>
      )}
      <button className={styles.linkBtn} onClick={copyInviteLink}>
        {linkCopied ? 'Copied!' : 'Copy invite link'}
      </button>
    </div>
  )

  return (
    <div className={styles.root}>
      {/* ── Nav ── */}
      <PageHeader
        user={user}
        rightSlot={
          <>
            <Link href={`/creator/preview/${lessonId}`} className={styles.navLink}>Preview →</Link>
            <Link href={`/learn/${lessonId}`} className={styles.navLink}>Take lesson →</Link>
          </>
        }
      />

      {/* ── Body ── */}
      <div className={styles.body}>
        <LessonBlockEditor
          lessonId={lessonId}
          initialManifest={manifest}
          initialPublishedAt={publishedAt}
          panelMode="float"
          rightPanelExtra={sharePanel}
          canPexels={canPexels}
          canAiEdit={aiEditEnabled}
          plan={plan}
          isInternal={!!internalRole}
        />
      </div>
    </div>
  )
}

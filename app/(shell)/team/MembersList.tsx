'use client'

import { useState } from 'react'
import styles from './page.module.css'

interface Member {
  id: string
  email: string
  name: string | null
  isOwner: boolean
}

export function MembersList({ members }: { members: Member[] }) {
  return (
    <ul className={styles.memberList}>
      {members.map((m) => (
        <MemberRow key={m.id} member={m} />
      ))}
    </ul>
  )
}

function MemberRow({ member }: { member: Member }) {
  const [removing, setRemoving] = useState(false)

  async function remove() {
    if (!confirm(`Remove ${member.email} from the team?`)) return
    setRemoving(true)
    const res = await fetch(`/api/team/members/${member.id}`, {
      method: 'DELETE',
    })
    if (res.ok) window.location.reload()
    else setRemoving(false)
  }

  return (
    <li className={styles.memberRow}>
      <span>
        <strong>{member.name ?? member.email}</strong>
        {member.name && <span className={styles.muted}> — {member.email}</span>}
      </span>
      {member.isOwner ? (
        <span className={styles.ownerBadge}>Owner</span>
      ) : (
        <button onClick={remove} disabled={removing} className={styles.removeBtn}>
          {removing ? 'Removing…' : 'Remove'}
        </button>
      )}
    </li>
  )
}

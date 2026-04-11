'use client'

import type { TeacherRosterRow } from '@/lib/teacher-roster'

const STUDENT_CAP = 150

interface Props {
  roster: TeacherRosterRow[]
}

export default function StudentsTable({ roster }: Props) {
  const usedSeats = roster.length
  const overCap = usedSeats >= STUDENT_CAP

  return (
    <div style={{ fontFamily: "'DM Sans', system-ui, sans-serif", color: 'var(--ink)' }}>
      <div style={{ marginBottom: '1.5rem', display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
        <h2 style={{ margin: 0, fontSize: 20, fontWeight: 600, color: 'var(--ink)' }}>Your Students</h2>
        <span style={{ color: overCap ? 'var(--color-coral, #c00)' : 'var(--ink-muted)', fontSize: 14 }}>
          {usedSeats} / {STUDENT_CAP} students
          {overCap && ' — upgrade for unlimited seats'}
        </span>
      </div>

      {roster.length === 0 && (
        <p style={{ margin: 0, fontSize: 15, color: 'var(--ink-soft)', lineHeight: 1.6 }}>
          No students yet. Invite students to your lessons or enroll them in your courses to see their progress here.
        </p>
      )}

      {roster.length > 0 && (
        <table style={{ width: '100%', borderCollapse: 'collapse', fontSize: 14 }}>
          <thead>
            <tr style={{ borderBottom: '1px solid var(--border)' }}>
              <th style={{ textAlign: 'left', padding: '8px 0', fontWeight: 600, color: 'var(--ink-muted)' }}>Email</th>
              <th style={{ textAlign: 'center', padding: '8px 0', fontWeight: 600, color: 'var(--ink-muted)' }}>Lessons started</th>
              <th style={{ textAlign: 'center', padding: '8px 0', fontWeight: 600, color: 'var(--ink-muted)' }}>Lessons completed</th>
              <th style={{ textAlign: 'center', padding: '8px 0', fontWeight: 600, color: 'var(--ink-muted)' }}>Avg. score</th>
              <th style={{ textAlign: 'right', padding: '8px 0', fontWeight: 600, color: 'var(--ink-muted)' }}>Last activity</th>
            </tr>
          </thead>
          <tbody>
            {roster.map(row => (
              <tr key={row.email} style={{ borderBottom: '1px solid var(--border)' }}>
                <td style={{ padding: '10px 0', color: 'var(--ink)' }}>{row.email}</td>
                <td style={{ padding: '10px 0', textAlign: 'center', color: 'var(--ink-soft)' }}>{row.lessonsStarted}</td>
                <td style={{ padding: '10px 0', textAlign: 'center', color: 'var(--ink-soft)' }}>{row.lessonsCompleted}</td>
                <td style={{ padding: '10px 0', textAlign: 'center', color: 'var(--ink-soft)' }}>
                  {row.averageScore != null ? `${Math.round(row.averageScore * 100)}%` : '—'}
                </td>
                <td style={{ padding: '10px 0', textAlign: 'right', color: 'var(--ink-muted)' }}>
                  {row.lastActivity ? new Date(row.lastActivity).toLocaleDateString() : '—'}
                </td>
              </tr>
            ))}
          </tbody>
        </table>
      )}
    </div>
  )
}

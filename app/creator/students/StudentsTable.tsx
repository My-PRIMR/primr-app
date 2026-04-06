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
    <div>
      <div style={{ marginBottom: '1rem', display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
        <h2>Your Students</h2>
        <div style={{ color: overCap ? '#c00' : '#666', fontSize: 14 }}>
          {usedSeats} / {STUDENT_CAP} students
          {overCap && ' — upgrade for unlimited seats'}
        </div>
      </div>

      {roster.length === 0 && (
        <p>No students yet. Invite students to your lessons or enroll them in your courses to see their progress here.</p>
      )}

      {roster.length > 0 && (
        <table style={{ width: '100%', borderCollapse: 'collapse' }}>
          <thead>
            <tr>
              <th style={{ textAlign: 'left' }}>Email</th>
              <th>Lessons started</th>
              <th>Lessons completed</th>
              <th>Avg. score</th>
              <th>Last activity</th>
            </tr>
          </thead>
          <tbody>
            {roster.map(row => (
              <tr key={row.email}>
                <td>{row.email}</td>
                <td>{row.lessonsStarted}</td>
                <td>{row.lessonsCompleted}</td>
                <td>{row.averageScore != null ? `${Math.round(row.averageScore * 100)}%` : '—'}</td>
                <td>{row.lastActivity ? new Date(row.lastActivity).toLocaleDateString() : '—'}</td>
              </tr>
            ))}
          </tbody>
        </table>
      )}
    </div>
  )
}

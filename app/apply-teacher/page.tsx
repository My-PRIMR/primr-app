'use client'

import { useState } from 'react'

export default function ApplyTeacherPage() {
  const [submitting, setSubmitting] = useState(false)
  const [submitted, setSubmitted] = useState(false)
  const [error, setError] = useState('')

  async function handleSubmit(e: React.FormEvent<HTMLFormElement>) {
    e.preventDefault()
    setSubmitting(true)
    setError('')
    const formData = new FormData(e.currentTarget)
    const res = await fetch('/api/teacher-application', { method: 'POST', body: formData })
    setSubmitting(false)
    if (!res.ok) {
      const data = await res.json().catch(() => ({}))
      setError(data.error ?? 'Submission failed')
      return
    }
    setSubmitted(true)
  }

  if (submitted) {
    return (
      <main style={{ maxWidth: 560, margin: '4rem auto', padding: '0 1.5rem', fontFamily: 'system-ui' }}>
        <h1>Application received</h1>
        <p>Thank you. We&apos;ll review your application and email you within 2 business days.</p>
        <p><a href="https://getprimr.com">← Back to Primr</a></p>
      </main>
    )
  }

  return (
    <main style={{ maxWidth: 560, margin: '4rem auto', padding: '0 1.5rem', fontFamily: 'system-ui' }}>
      <h1>Apply for the Teacher tier</h1>
      <p>Free for verified K-12 teachers using Primr with their own students. Submit one of the documents below to verify your role.</p>

      <form onSubmit={handleSubmit} style={{ display: 'flex', flexDirection: 'column', gap: '1rem', marginTop: '2rem' }}>
        <label>
          Full name
          <input name="name" required style={{ display: 'block', width: '100%', padding: '0.5rem', marginTop: '0.25rem' }} />
        </label>
        <label>
          Contact email
          <input name="email" type="email" required style={{ display: 'block', width: '100%', padding: '0.5rem', marginTop: '0.25rem' }} />
        </label>
        <label>
          School name
          <input name="schoolName" required style={{ display: 'block', width: '100%', padding: '0.5rem', marginTop: '0.25rem' }} />
        </label>
        <label>
          Grade level
          <select name="gradeLevel" required style={{ display: 'block', width: '100%', padding: '0.5rem', marginTop: '0.25rem' }}>
            <option value="">Choose…</option>
            <option>Elementary K-5</option>
            <option>Middle 6-8</option>
            <option>High 9-12</option>
            <option>Other K-12</option>
          </select>
        </label>
        <label>
          Current role
          <select name="currentRole" required style={{ display: 'block', width: '100%', padding: '0.5rem', marginTop: '0.25rem' }}>
            <option value="">Choose…</option>
            <option>Classroom teacher</option>
            <option>Specialist</option>
            <option>Substitute</option>
            <option>Administrator</option>
            <option>Other</option>
          </select>
        </label>
        <label>
          Proof of role (school photo ID badge, pay stub, employment verification letter, faculty/staff directory page, or teaching certificate). PDF, PNG, JPG, or WebP up to 5 MB.
          <input name="proof" type="file" accept="image/png,image/jpeg,image/webp,application/pdf" required style={{ display: 'block', width: '100%', marginTop: '0.25rem' }} />
        </label>
        {error && <p style={{ color: '#c00' }}>{error}</p>}
        <button type="submit" disabled={submitting} style={{ padding: '0.75rem 1.5rem', fontSize: '1rem' }}>
          {submitting ? 'Submitting…' : 'Submit application'}
        </button>
      </form>
    </main>
  )
}

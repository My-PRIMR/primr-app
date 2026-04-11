'use client'

import { useState } from 'react'
import styles from './ApplyTeacher.module.css'

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
      if (res.status === 409) {
        setError('We already received your application — expect an email soon.')
      } else if (res.status === 429) {
        setError('Too many submissions from this address. Please try again later.')
      } else {
        setError(data.error ?? 'Submission failed. Please try again.')
      }
      return
    }
    setSubmitted(true)
  }

  if (submitted) {
    return (
      <main className={styles.main}>
        <div className={styles.container}>
          <div className={styles.successCard}>
            <span className={styles.kicker}>Application received</span>
            <h1 className={styles.h1}>Thanks — we&apos;ll be in touch.</h1>
            <p className={styles.body}>
              We review every application by hand and will email you a decision within 2 business days.
              If we need more information, we&apos;ll let you know what&apos;s missing — no silent rejections.
            </p>
            <a href="https://getprimr.com" className={styles.btnPrimary}>← Back to Primr</a>
          </div>
        </div>
      </main>
    )
  }

  return (
    <main className={styles.main}>
      <div className={styles.container}>
        <div className={styles.heroSplit}>
          <div>
            <span className={styles.kicker}>For K-12 teachers</span>
            <h1 className={styles.h1}>
              Apply for the<br />
              <em>Teacher tier.</em>
            </h1>
            <p className={styles.body}>
              Free for verified K-12 teachers using Primr with their own students.
              Fill out the form below and attach proof of your role. We&apos;ll email you a
              decision within 2 business days.
            </p>
          </div>

          <div className={styles.artifactBox}>
            <span className={styles.artifactLabel}>What happens next</span>
            <div className={styles.artifactStep}>
              <span className={styles.stepNum}>1</span>
              <div>
                <strong>Submit this form.</strong>
                <p>Basic info and one proof document.</p>
              </div>
            </div>
            <div className={styles.artifactStep}>
              <span className={styles.stepNum}>2</span>
              <div>
                <strong>We review by hand.</strong>
                <p>Every application is reviewed by a real person — usually within 2 business days.</p>
              </div>
            </div>
            <div className={styles.artifactStep}>
              <span className={styles.stepNum}>3</span>
              <div>
                <strong>We email you a decision.</strong>
                <p>Approved means you&apos;re in. Rejected means we&apos;ll tell you what&apos;s missing.</p>
              </div>
            </div>
          </div>
        </div>

        <div className={styles.formCard}>
          <form onSubmit={handleSubmit} className={styles.form}>
            <input type="hidden" name="source" value="marketing" />

            <div aria-hidden="true" className={styles.honeypot}>
              <label>
                Website
                <input name="website" type="text" tabIndex={-1} autoComplete="off" />
              </label>
            </div>

            <label className={styles.fieldLabel}>
              Full name
              <input name="name" required className={styles.input} />
            </label>
            <label className={styles.fieldLabel}>
              Contact email
              <input name="email" type="email" required className={styles.input} />
            </label>
            <label className={styles.fieldLabel}>
              School name
              <input name="schoolName" required className={styles.input} />
            </label>
            <label className={styles.fieldLabel}>
              Grade level
              <select name="gradeLevel" required className={styles.input}>
                <option value="">Choose…</option>
                <option>Elementary K-5</option>
                <option>Middle 6-8</option>
                <option>High 9-12</option>
                <option>Other K-12</option>
              </select>
            </label>
            <label className={styles.fieldLabel}>
              Current role
              <select name="currentRole" required className={styles.input}>
                <option value="">Choose…</option>
                <option>Classroom teacher</option>
                <option>Specialist</option>
                <option>Substitute</option>
                <option>Administrator</option>
                <option>Other</option>
              </select>
            </label>
            <label className={styles.fieldLabel}>
              <span>Proof of role</span>
              <span className={styles.fieldHint}>
                School photo ID badge, pay stub, employment verification letter,
                faculty/staff directory page, or teaching certificate. PDF, PNG, JPG, or WebP up to 5 MB.
              </span>
              <input
                name="proof"
                type="file"
                accept="image/png,image/jpeg,image/webp,application/pdf"
                required
                className={styles.input}
              />
            </label>

            {error && <p className={styles.error}>{error}</p>}

            <button type="submit" className={styles.btnPrimary} disabled={submitting}>
              {submitting ? 'Submitting…' : 'Submit application →'}
            </button>
          </form>
        </div>
      </div>
    </main>
  )
}

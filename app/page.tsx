import { redirect } from 'next/navigation'
import Link from 'next/link'
import { getSession } from '@/session'
import styles from './page.module.css'

export default async function Home() {
  const session = await getSession()
  if (session) redirect('/creator')
  const authUrl = process.env.PRIMR_AUTH_URL ?? 'http://localhost:3001'
  const appUrl = process.env.PRIMR_APP_URL ?? 'http://localhost:3000'
  redirect(`${authUrl}/login?callbackUrl=${encodeURIComponent(`${appUrl}/creator`)}`)
  return (
    <main className={styles.main}>
      <nav className={styles.nav}>
        <span className={styles.wordmark}>Primr</span>
        <div className={styles.navLinks}>
          <Link href="/creator/new" className={styles.navCta}>Start creating →</Link>
        </div>
      </nav>

      <section className={styles.hero}>
        <div className={styles.heroBadge}>Now in beta</div>
        <h1 className={styles.heroTitle}>
          The platform for<br />interactive learning.
        </h1>
        <p className={styles.heroSub}>
          Describe what you want to teach. Primr's AI builds a rich,
          interactive lesson — walkthroughs, quizzes, flip cards — in seconds.
          No design skills required.
        </p>
        <div className={styles.heroCtas}>
          <Link href="/creator/new" className={styles.ctaPrimary}>
            Create a lesson
          </Link>
          <Link href="/gus/how-to-create-a-primr-lesson" className={styles.ctaSecondary}>
            See an example →
          </Link>
        </div>
      </section>

      <section className={styles.features}>
        {[
          { icon: '✦', title: 'AI-powered', body: 'Describe your lesson in plain English. The AI selects components, writes content, and lays it out.' },
          { icon: '◈', title: 'Interactive by default', body: 'Every lesson is a sequence of walkthroughs, quizzes, and flip cards — not a wall of text.' },
          { icon: '⟐', title: 'Yours to own', body: 'Export any lesson as a .primr.md file. Host it anywhere. No lock-in.' },
        ].map(f => (
          <div key={f.title} className={styles.featureCard}>
            <div className={styles.featureIcon}>{f.icon}</div>
            <h3 className={styles.featureTitle}>{f.title}</h3>
            <p className={styles.featureBody}>{f.body}</p>
          </div>
        ))}
      </section>
    </main>
  )
}

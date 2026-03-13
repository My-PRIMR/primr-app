import Link from 'next/link'
import { notFound } from 'next/navigation'
import { db } from '@/db'
import { lessons } from '@/db/schema'
import { eq } from 'drizzle-orm'
import LessonView from './LessonView'
import styles from '../../new/page.module.css'

export default async function PreviewPage({ params }: { params: Promise<{ id: string }> }) {
  const { id } = await params

  const lesson = await db.query.lessons.findFirst({
    where: eq(lessons.id, id),
  })

  if (!lesson) notFound()

  return (
    <main className={styles.main}>
      <nav className={styles.nav}>
        <Link href="/dashboard" className={styles.wordmark}>Primr</Link>
      </nav>
      <div className={styles.content}>
        <LessonView manifest={lesson.manifest} />
      </div>
    </main>
  )
}

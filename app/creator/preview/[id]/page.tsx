import { notFound } from 'next/navigation'
import Link from 'next/link'
import { db } from '@/db'
import { lessons } from '@/db/schema'
import { eq } from 'drizzle-orm'
import PageHeaderServer from '../../../components/PageHeaderServer'
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
      <PageHeaderServer
        leftSlot={<Link href={`/creator/edit/${id}`} style={{ fontSize: 13, fontWeight: 500, color: 'var(--ink-muted)', textDecoration: 'none' }}>← Exit</Link>}
      />
      <div className={styles.content}>
        <LessonView manifest={lesson.manifest} />
      </div>
    </main>
  )
}

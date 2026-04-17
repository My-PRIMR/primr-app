import { NextRequest, NextResponse } from 'next/server'
import { getSession } from '@/session'
import { db } from '@/db'
import { lessons } from '@/db/schema'
import { eq } from 'drizzle-orm'

const OWNER = 'My-PRIMR'
const REPO = 'primr-components'

export async function POST(
  req: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  const session = await getSession()
  if (!session?.user?.internalRole) {
    return NextResponse.json({ error: 'Internal users only' }, { status: 403 })
  }

  const { id: lessonId } = await params
  const { blockId, blockIndex, blockType, description } = await req.json()

  if (!description?.trim()) {
    return NextResponse.json({ error: 'Description is required' }, { status: 400 })
  }

  const token = process.env.GITHUB_TOKEN
  if (!token) {
    return NextResponse.json({ error: 'GITHUB_TOKEN not configured' }, { status: 500 })
  }

  // Look up the lesson for context
  const lesson = await db.query.lessons.findFirst({ where: eq(lessons.id, lessonId) })
  const lessonTitle = lesson?.title ?? 'Unknown lesson'
  const lessonUrl = `${process.env.PRIMR_APP_URL ?? 'https://primr.me'}/learn/${lessonId}`

  const issueTitle = `[Bug] ${blockType} block (#${blockIndex + 1}) in "${lessonTitle}"`
  const issueBody = [
    `## Bug Report`,
    ``,
    `**Reporter:** ${session.user.email ?? session.user.name ?? 'unknown'}`,
    `**Lesson:** [${lessonTitle}](${lessonUrl})`,
    `**Block:** #${blockIndex + 1} — \`${blockType}\` (id: \`${blockId}\`)`,
    ``,
    `## Description`,
    ``,
    description,
    ``,
    `---`,
    `*Created from the Primr lesson player by an internal user.*`,
  ].join('\n')

  const labels = ['bug', `block:${blockType}`]

  try {
    const res = await fetch(`https://api.github.com/repos/${OWNER}/${REPO}/issues`, {
      method: 'POST',
      headers: {
        Authorization: `Bearer ${token}`,
        Accept: 'application/vnd.github.v3+json',
        'Content-Type': 'application/json',
      },
      body: JSON.stringify({
        title: issueTitle,
        body: issueBody,
        labels,
      }),
    })

    if (!res.ok) {
      const body = await res.text()
      console.error(`[bug-report] GitHub API ${res.status}: ${body}`)
      return NextResponse.json({ error: 'Failed to create GitHub issue' }, { status: 502 })
    }

    const data = await res.json() as { html_url: string; number: number }
    return NextResponse.json({ ok: true, issueUrl: data.html_url, issueNumber: data.number })
  } catch (err) {
    console.error('[bug-report] error:', err)
    return NextResponse.json({ error: 'Failed to create GitHub issue' }, { status: 500 })
  }
}

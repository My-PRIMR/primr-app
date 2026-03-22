import { loadTemplate, render, escapeHtml } from './email-template-loader'

interface EmailContent {
  subject: string
  html: string
  text: string
}

// ── Helpers ───────────────────────────────────────────────────────────────────

function lessonWord(n: number) {
  return n !== 1 ? 'lessons' : 'lesson'
}

// ── Templates ─────────────────────────────────────────────────────────────────

export async function lessonInviteEmail({
  lessonTitle,
  inviteUrl,
}: {
  lessonTitle: string | null | undefined
  inviteUrl: string
}): Promise<EmailContent> {
  const [html, text] = await Promise.all([
    loadTemplate('lesson-invite.html'),
    loadTemplate('lesson-invite.txt'),
  ])
  const titleSuffix = lessonTitle
    ? `: <strong style="color:#1a1c26;">${escapeHtml(lessonTitle)}</strong>`
    : ''
  return {
    subject: lessonTitle
      ? `You've been invited to "${lessonTitle}" on Primr`
      : `You've been invited to a lesson on Primr`,
    html: render(html, { inviteUrl }, { titleSuffix }),
    text: render(text, { inviteUrl, titleText: lessonTitle ? `: ${lessonTitle}` : '' }),
  }
}

export async function courseInviteEmail({
  courseTitle,
  inviteUrl,
}: {
  courseTitle: string | null | undefined
  inviteUrl: string
}): Promise<EmailContent> {
  const [html, text] = await Promise.all([
    loadTemplate('course-invite.html'),
    loadTemplate('course-invite.txt'),
  ])
  const titleSuffix = courseTitle
    ? `: <strong style="color:#1a1c26;">${escapeHtml(courseTitle)}</strong>`
    : ''
  return {
    subject: courseTitle
      ? `You've been invited to "${courseTitle}" on Primr`
      : `You've been invited to a course on Primr`,
    html: render(html, { inviteUrl }, { titleSuffix }),
    text: render(text, { inviteUrl, titleText: courseTitle ? `: ${courseTitle}` : '' }),
  }
}

export async function courseCompleteEmail({
  courseTitle,
  courseUrl,
  doneCount,
  failedCount,
}: {
  courseTitle: string
  courseUrl: string
  doneCount: number
  failedCount: number
}): Promise<EmailContent> {
  const hasFailures = failedCount > 0
  const templateName = hasFailures ? 'course-complete-failed' : 'course-complete-ok'
  const [html, text] = await Promise.all([
    loadTemplate(`${templateName}.html`),
    loadTemplate(`${templateName}.txt`),
  ])

  const vars: Record<string, string | number> = { courseTitle, courseUrl, doneCount }
  if (hasFailures) {
    vars.failedCount = failedCount
    vars.lessonWordDone = lessonWord(doneCount)
    vars.lessonWordFailed = lessonWord(failedCount)
  } else {
    vars.lessonWord = lessonWord(doneCount)
  }

  const subject = hasFailures
    ? `Your course "${courseTitle}" finished with ${failedCount} failed ${lessonWord(failedCount)}`
    : `Your course "${courseTitle}" is ready`

  return { subject, html: render(html, vars), text: render(text, vars) }
}

export async function courseInterruptedEmail({
  courseTitle,
  courseUrl,
  doneCount,
  failedCount,
}: {
  courseTitle: string
  courseUrl: string
  doneCount: number
  failedCount: number
}): Promise<EmailContent> {
  const [html, text] = await Promise.all([
    loadTemplate('course-interrupted.html'),
    loadTemplate('course-interrupted.txt'),
  ])

  const htmlLines: string[] = []
  const textLines: string[] = []
  if (doneCount > 0) {
    htmlLines.push(`<li>✅ ${doneCount} ${lessonWord(doneCount)} completed successfully</li>`)
    textLines.push(`${doneCount} ${lessonWord(doneCount)} completed.`)
  }
  if (failedCount > 0) {
    htmlLines.push(`<li>❌ ${failedCount} ${lessonWord(failedCount)} did not finish — you can retry them from the course editor</li>`)
    textLines.push(`${failedCount} ${lessonWord(failedCount)} did not finish — retry from the course editor.`)
  }

  const statusHtml = htmlLines.length > 0
    ? `<ul style="margin:12px 0 0;padding-left:20px;font-size:15px;color:#4a4d5e;line-height:1.8;">${htmlLines.join('')}</ul>`
    : ''

  return {
    subject: `Your course "${courseTitle}" was interrupted`,
    html: render(html, { courseTitle, courseUrl }, { statusHtml }),
    text: render(text, { courseTitle, courseUrl, statusText: textLines.join('\n') }),
  }
}

interface EmailContent {
  subject: string
  html: string
  text: string
}

// ── Shared layout ────────────────────────────────────────────────────────────

function layout(body: string, footerNote?: string): string {
  return `<!DOCTYPE html>
<html lang="en">
<head>
  <meta charset="UTF-8" />
  <meta name="viewport" content="width=device-width, initial-scale=1.0" />
</head>
<body style="margin:0;padding:0;background:#f5f4f1;font-family:'DM Sans',Helvetica,Arial,sans-serif;">
  <table width="100%" cellpadding="0" cellspacing="0" style="background:#f5f4f1;padding:40px 16px;">
    <tr><td align="center">
      <table width="100%" style="max-width:560px;background:#ffffff;border-radius:12px;overflow:hidden;border:1px solid rgba(15,17,23,0.08);">

        <!-- Header -->
        <tr>
          <td style="padding:28px 40px 20px;border-bottom:1px solid rgba(15,17,23,0.06);">
            <span style="font-family:Georgia,serif;font-size:22px;font-weight:400;color:#1a1c26;letter-spacing:-0.02em;">Primr</span>
          </td>
        </tr>

        <!-- Body -->
        <tr>
          <td style="padding:32px 40px;">
            ${body}
          </td>
        </tr>

        <!-- Footer -->
        <tr>
          <td style="padding:20px 40px;border-top:1px solid rgba(15,17,23,0.06);">
            <p style="margin:0;font-size:12px;color:#9da3b4;line-height:1.5;">
              ${footerNote ?? 'You received this email because an action was taken on your Primr account.'}
              Questions? Reply to this email or contact <a href="mailto:support@primr.me" style="color:#6B5CE7;text-decoration:none;">support@primr.me</a>.
            </p>
          </td>
        </tr>

      </table>
    </td></tr>
  </table>
</body>
</html>`
}

function ctaButton(label: string, url: string): string {
  return `<p style="margin:24px 0 0;">
    <a href="${url}" style="display:inline-block;padding:12px 24px;background:#6B5CE7;color:#ffffff;border-radius:8px;font-size:15px;font-weight:500;text-decoration:none;">${label}</a>
  </p>`
}

// ── Templates ────────────────────────────────────────────────────────────────

export function lessonInviteEmail({
  lessonTitle,
  inviteUrl,
}: {
  lessonTitle: string | null | undefined
  inviteUrl: string
}): EmailContent {
  const titlePart = lessonTitle ? `: <strong style="color:#1a1c26;">${lessonTitle}</strong>` : ''
  const titleText = lessonTitle ? `: ${lessonTitle}` : ''

  return {
    subject: lessonTitle
      ? `You've been invited to "${lessonTitle}" on Primr`
      : `You've been invited to a lesson on Primr`,
    html: layout(
      `<p style="margin:0 0 8px;font-size:24px;font-weight:400;color:#1a1c26;font-family:Georgia,serif;">You're invited</p>
       <p style="margin:12px 0 0;font-size:15px;color:#4a4d5e;line-height:1.65;">
         You've been invited to a lesson on Primr${titlePart}.
         Click below to accept and start learning.
       </p>
       ${ctaButton('Accept invite →', inviteUrl)}
       <p style="margin:16px 0 0;font-size:13px;color:#9da3b4;">Or copy this link: <a href="${inviteUrl}" style="color:#6B5CE7;word-break:break-all;">${inviteUrl}</a></p>`,
      `You received this because someone invited you to a Primr lesson.`
    ),
    text: `You've been invited to a lesson on Primr${titleText}.\n\nAccept invite: ${inviteUrl}`,
  }
}

export function courseInviteEmail({
  courseTitle,
  inviteUrl,
}: {
  courseTitle: string | null | undefined
  inviteUrl: string
}): EmailContent {
  const titlePart = courseTitle ? `: <strong style="color:#1a1c26;">${courseTitle}</strong>` : ''
  const titleText = courseTitle ? `: ${courseTitle}` : ''

  return {
    subject: courseTitle
      ? `You've been invited to "${courseTitle}" on Primr`
      : `You've been invited to a course on Primr`,
    html: layout(
      `<p style="margin:0 0 8px;font-size:24px;font-weight:400;color:#1a1c26;font-family:Georgia,serif;">You're invited</p>
       <p style="margin:12px 0 0;font-size:15px;color:#4a4d5e;line-height:1.65;">
         You've been invited to a course on Primr${titlePart}.
         Click below to accept and start learning.
       </p>
       ${ctaButton('Accept invite →', inviteUrl)}
       <p style="margin:16px 0 0;font-size:13px;color:#9da3b4;">Or copy this link: <a href="${inviteUrl}" style="color:#6B5CE7;word-break:break-all;">${inviteUrl}</a></p>`,
      `You received this because someone invited you to a Primr course.`
    ),
    text: `You've been invited to a course on Primr${titleText}.\n\nAccept invite: ${inviteUrl}`,
  }
}

export function courseCompleteEmail({
  courseTitle,
  courseUrl,
  doneCount,
  failedCount,
}: {
  courseTitle: string
  courseUrl: string
  doneCount: number
  failedCount: number
}): EmailContent {
  const hasFailures = failedCount > 0
  const lessonWord = (n: number) => `lesson${n !== 1 ? 's' : ''}`

  const subject = hasFailures
    ? `Your course "${courseTitle}" finished with ${failedCount} failed ${lessonWord(failedCount)}`
    : `Your course "${courseTitle}" is ready`

  const bodyHtml = hasFailures
    ? `<p style="margin:0 0 8px;font-size:24px;font-weight:400;color:#1a1c26;font-family:Georgia,serif;">Course generation finished</p>
       <p style="margin:12px 0 0;font-size:15px;color:#4a4d5e;line-height:1.65;">
         <strong style="color:#1a1c26;">${courseTitle}</strong> finished generating with some issues:
       </p>
       <ul style="margin:12px 0 0;padding-left:20px;font-size:15px;color:#4a4d5e;line-height:1.8;">
         <li>✅ ${doneCount} ${lessonWord(doneCount)} generated successfully</li>
         <li>❌ ${failedCount} ${lessonWord(failedCount)} failed — you can retry them from the course editor</li>
       </ul>
       ${ctaButton('Open course editor →', courseUrl)}`
    : `<p style="margin:0 0 8px;font-size:24px;font-weight:400;color:#1a1c26;font-family:Georgia,serif;">Your course is ready</p>
       <p style="margin:12px 0 0;font-size:15px;color:#4a4d5e;line-height:1.65;">
         <strong style="color:#1a1c26;">${courseTitle}</strong> is ready with ${doneCount} ${lessonWord(doneCount)}. Open it to preview, share, or invite learners.
       </p>
       ${ctaButton('Open course →', courseUrl)}`

  const textBody = hasFailures
    ? `Your course "${courseTitle}" finished. ${doneCount} ${lessonWord(doneCount)} done, ${failedCount} failed.\n\nOpen the course editor to retry failed lessons:\n${courseUrl}`
    : `Your course "${courseTitle}" is ready with ${doneCount} ${lessonWord(doneCount)}.\n\n${courseUrl}`

  return {
    subject,
    html: layout(bodyHtml),
    text: textBody,
  }
}

export function courseInterruptedEmail({
  courseTitle,
  courseUrl,
  doneCount,
  failedCount,
}: {
  courseTitle: string
  courseUrl: string
  doneCount: number
  failedCount: number
}): EmailContent {
  const lessonWord = (n: number) => `lesson${n !== 1 ? 's' : ''}`

  const statusLines: string[] = []
  const statusText: string[] = []
  if (doneCount > 0) {
    statusLines.push(`<li>✅ ${doneCount} ${lessonWord(doneCount)} completed successfully</li>`)
    statusText.push(`${doneCount} ${lessonWord(doneCount)} completed.`)
  }
  if (failedCount > 0) {
    statusLines.push(`<li>❌ ${failedCount} ${lessonWord(failedCount)} did not finish — you can retry from the course editor</li>`)
    statusText.push(`${failedCount} ${lessonWord(failedCount)} did not finish — retry from the course editor.`)
  }

  return {
    subject: `Your course "${courseTitle}" was interrupted`,
    html: layout(
      `<p style="margin:0 0 8px;font-size:24px;font-weight:400;color:#1a1c26;font-family:Georgia,serif;">Course generation interrupted</p>
       <p style="margin:12px 0 0;font-size:15px;color:#4a4d5e;line-height:1.65;">
         <strong style="color:#1a1c26;">${courseTitle}</strong> was interrupted when the server restarted.
       </p>
       ${statusLines.length > 0 ? `<ul style="margin:12px 0 0;padding-left:20px;font-size:15px;color:#4a4d5e;line-height:1.8;">${statusLines.join('')}</ul>` : ''}
       ${ctaButton('Open course editor →', courseUrl)}`
    ),
    text: `Your course "${courseTitle}" was interrupted by a server restart.\n\n${statusText.join('\n')}\n\n${courseUrl}`,
  }
}

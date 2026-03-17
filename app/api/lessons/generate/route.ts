import { NextRequest, NextResponse } from 'next/server'
import Anthropic from '@anthropic-ai/sdk'
import { db } from '@/db'
import { lessons } from '@/db/schema'
import { getSession } from '@/session'
import type { LessonManifest } from '@primr/components'
import type { LessonOutline } from '@/types/outline'

const client = new Anthropic()

const BLOCK_SCHEMAS = `Block prop schemas:

hero:
  title: string (required) — large serif title
  tagline?: string — one sentence
  meta?: Array<{ label: string, icon?: 'clock' | 'level' | 'tag' }>
  cta?: string — CTA button label (default: "Start lesson")

narrative:
  body: string (required) — markdown text
  title?: string — serif heading
  eyebrow?: string — small uppercase label

step-navigator:
  steps: Array<{ title: string, body: string, hint?: string }>
  badge?: string — e.g. "Step walkthrough"
  title?: string

quiz:
  questions: Array<{ prompt: string, options: string[], correctIndex: number, explanation?: string }>
  badge?: string
  title?: string
  passScore?: number — 0 to 1

flashcard:
  cards: Array<{ front: string, back: string }>
  badge?: string
  title?: string

fill-in-the-blank:
  prompt: string — text with {{blank}} placeholders
  answers: Array<string | string[]> — one entry per blank, can be array of accepted answers
  badge?: string
  title?: string
  hint?: string
  IMPORTANT: Each answer must be 1-2 words only, no punctuation. Design blanks so short answers work (e.g. "The {{blank}} protocol uses port {{blank}}" → ["TCP", "80"]).`

const LEGACY_SYSTEM_PROMPT = `You are an expert instructional designer. Given a topic, generate a complete Primr lesson as a JSON object.

Return this structure:
{
  "id": "kebab-case-id",
  "title": "Lesson Title",
  "slug": "kebab-case-slug",
  "blocks": [{ "id": "block-id", "type": "block-type", "props": { ... } }]
}

${BLOCK_SCHEMAS}

Rules:
- Always start with a 'hero' block
- Include 4–7 blocks total mixing narrative, step-navigator, quiz, flashcard, or fill-in-the-blank
- Body/prompt fields support markdown: **bold**, *italic*, __underline__, \`code\`, and links
- Keep content concise: narrative body max ~150 words, quiz explanations max ~30 words, step body max ~100 words
- Flashcard decks: max 6 cards. Quiz: max 5 questions. Step-navigator: max 5 steps.
- Return ONLY valid JSON. No explanation, no markdown fences, no extra text.`

const OUTLINE_SYSTEM_PROMPT = `You are an expert instructional designer. Generate a complete Primr lesson as JSON from the provided outline. Each block in the outline specifies a type, summary of what it should cover, and optionally an item count.

Return this structure:
{
  "id": "kebab-case-id",
  "title": "Lesson Title",
  "slug": "kebab-case-slug",
  "blocks": [{ "id": "block-id", "type": "block-type", "props": { ... } }]
}

${BLOCK_SCHEMAS}

Rules:
- Generate exactly the blocks listed in the outline, in the same order, with the same IDs and types
- Use each block's summary to guide the content you generate for its props
- If itemCount is specified, generate exactly that many items (questions, cards, steps, etc.)
- Tailor content to the specified audience and level
- Body/prompt fields support markdown: **bold**, *italic*, __underline__, \`code\`, and links
- Keep content concise: narrative body max ~150 words, quiz explanations max ~30 words, step body max ~100 words
- Flashcard decks: max 6 cards. Quiz: max 5 questions. Step-navigator: max 5 steps.
- Return ONLY valid JSON. No explanation, no markdown fences, no extra text.`

function slugify(text: string): string {
  return text
    .toLowerCase()
    .replace(/[^a-z0-9\s-]/g, '')
    .trim()
    .replace(/\s+/g, '-')
    .replace(/-+/g, '-')
}

export async function POST(req: NextRequest) {
  const session = await getSession()
  const userId = session?.user?.id ?? null

  const body = await req.json()
  const outline: LessonOutline | undefined = body.outline
  const topic: string | undefined = body.topic
  const documentText: string | undefined = body.documentText

  if (!outline && !topic?.trim()) {
    return NextResponse.json({ error: 'outline or topic is required' }, { status: 400 })
  }

  const isOutlineBased = !!outline
  const systemPrompt = isOutlineBased ? OUTLINE_SYSTEM_PROMPT : LEGACY_SYSTEM_PROMPT
  const userMessage = isOutlineBased
    ? [
        topic?.trim() ? `Creator's intent: ${topic}\n` : '',
        `Generate a Primr lesson from this outline:\n\n${JSON.stringify(outline, null, 2)}`,
        documentText?.trim() ? `\n\nSource document (use this as the primary source for all content, facts, and questions — do not invent material not present in this document):\n"""\n${documentText}\n"""` : '',
      ].join('')
    : `Create a Primr lesson about: ${topic}`

  console.log(`[generate] mode: ${isOutlineBased ? 'outline' : 'legacy'}`)
  const t0 = Date.now()

  const message = await client.messages.create({
    model: 'claude-sonnet-4-6',
    max_tokens: 16384,
    system: systemPrompt,
    messages: [
      { role: 'user', content: userMessage },
      { role: 'assistant', content: '{' },
    ],
  })

  console.log(`[generate] responded in ${Date.now() - t0}ms, usage: ${JSON.stringify(message.usage)}`)

  const raw = message.content[0].type === 'text' ? '{' + message.content[0].text : ''
  const cleaned = raw.replace(/^```(?:json)?\s*/i, '').replace(/\s*```\s*$/i, '').trim()

  let manifest: LessonManifest
  try {
    manifest = JSON.parse(cleaned)
    console.log(`[generate] parsed manifest: id=${manifest.id}, blocks=${manifest.blocks.length}`)
  } catch (err) {
    console.error(`[generate] JSON parse failed:`, err)
    console.error(`[generate] full raw response:\n${raw}`)
    return NextResponse.json({ error: 'AI returned invalid JSON', raw }, { status: 500 })
  }

  const slug = `${slugify(manifest.slug || manifest.title)}-${Math.random().toString(36).slice(2, 7)}`
  manifest.slug = slug

  const t1 = Date.now()
  const [lesson] = await db.insert(lessons).values({
    slug,
    title: manifest.title,
    manifest,
    createdBy: userId,
  }).returning()
  console.log(`[generate] saved to DB in ${Date.now() - t1}ms, id=${lesson.id}`)

  return NextResponse.json({ id: lesson.id, manifest })
}

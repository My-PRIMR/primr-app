import './_load-env'
import { db } from '../src/db'
import { lessons } from '../src/db/schema'
import { eq } from 'drizzle-orm'
import type { LessonManifest } from '@primr/components'

interface HeroBlock {
  id: string
  type: 'hero'
  props: {
    title?: string
    tagline?: string
    meta?: Array<{ icon?: string; label?: string }>
    cta?: string
    image?: unknown
  }
}

interface HeroNewBlock {
  id: string
  type: 'hero-new'
  props: {
    title?: string
    subtitle?: string
    meta?: { duration?: string; source?: string }
    cta?: string
    kicker?: { course?: string; chapter?: string }
  }
}

interface AnyBlock {
  id: string
  type: string
  props: Record<string, unknown>
}

/**
 * Pure transformer for the old-hero → new-hero field mapping.
 * Exported for unit testing.
 */
export function transformHeroBlock(block: HeroBlock): HeroNewBlock {
  const out: HeroNewBlock = {
    id: block.id,
    type: 'hero-new',
    props: {},
  }
  if (block.props.title) out.props.title = block.props.title
  if (block.props.tagline) out.props.subtitle = block.props.tagline
  if (block.props.cta) out.props.cta = block.props.cta

  const meta: { duration?: string; source?: string } = {}
  for (const m of block.props.meta ?? []) {
    if (m.icon === 'clock' && !meta.duration && m.label) meta.duration = m.label
    if (m.icon === 'tag' && !meta.source && m.label) meta.source = m.label
  }
  if (meta.duration || meta.source) out.props.meta = meta

  return out
}

async function main() {
  const lessonId = process.argv[2]
  const dryRun = process.argv.includes('--dry-run')
  if (!lessonId) {
    console.error('usage: npx tsx scripts/migrate-hero-to-hero-new.ts <lessonId> [--dry-run]')
    process.exit(1)
  }

  const [row] = await db.select().from(lessons).where(eq(lessons.id, lessonId))
  if (!row) {
    console.error(`Lesson not found: ${lessonId}`)
    process.exit(1)
  }

  const manifest = row.manifest as unknown as { blocks: AnyBlock[]; [k: string]: unknown }
  const blocks: AnyBlock[] = Array.isArray(manifest?.blocks) ? manifest.blocks : []
  const heroBlocks = blocks.filter(b => b.type === 'hero')

  if (heroBlocks.length === 0) {
    console.log(`Lesson "${row.slug}" has no hero block — nothing to do.`)
    return
  }
  if (heroBlocks.length > 1) {
    console.error(`Lesson "${row.slug}" has ${heroBlocks.length} hero blocks; expected exactly 1. Aborting.`)
    process.exit(1)
  }

  const transformed = transformHeroBlock(heroBlocks[0] as HeroBlock)
  const newBlocks = blocks.map(b => (b === heroBlocks[0] ? transformed : b))
  const newManifest = { ...manifest, blocks: newBlocks }

  if (dryRun) {
    console.log('--- DRY RUN ---')
    console.log('Old hero block:')
    console.log(JSON.stringify(heroBlocks[0], null, 2))
    console.log('New hero-new block:')
    console.log(JSON.stringify(transformed, null, 2))
    return
  }

  await db.update(lessons).set({ manifest: newManifest as unknown as LessonManifest, updatedAt: new Date() }).where(eq(lessons.id, lessonId))
  console.log(`Migrated lesson "${row.slug}" (${row.id}): hero → hero-new`)
  console.log(JSON.stringify(transformed, null, 2))
}

// Run when invoked directly via tsx/ts-node, skip during unit tests (which import transformHeroBlock only).
// require.main === module works in CommonJS (Jest/ts-jest). When run via tsx (ESM), process.argv[1]
// points to this file, so we check both paths.
const _isMain =
  (typeof require !== 'undefined' && require.main === module) ||
  (typeof process !== 'undefined' && process.argv[1]?.endsWith('migrate-hero-to-hero-new.ts'))

if (_isMain) {
  main().then(() => process.exit(0)).catch(err => {
    console.error(err)
    process.exit(1)
  })
}

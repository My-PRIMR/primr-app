/**
 * Build email templates.
 *
 * Reads source templates from src/email-templates/, substitutes var(--token)
 * references with resolved values from primr-tokens/tokens.css (light-mode
 * :root block only — dark-mode overrides are irrelevant for email clients),
 * and writes the processed files to public/email-templates/.
 */
import { readFileSync, writeFileSync, readdirSync, mkdirSync } from 'fs'
import { fileURLToPath } from 'url'
import { dirname, join, resolve } from 'path'

const __dirname = dirname(fileURLToPath(import.meta.url))
const root = join(__dirname, '..')

/** Extract --var: value; pairs from a CSS block string (no nesting). */
function parseTokenBlock(block) {
  const tokens = {}
  const re = /--([\w-]+)\s*:\s*([^;]+);/g
  let m
  while ((m = re.exec(block)) !== null) {
    tokens[`--${m[1]}`] = m[2].trim()
  }
  return tokens
}

/**
 * Parse only the first (light-mode) :root block from a CSS file.
 * Stops before any @media rule so dark-mode overrides are ignored.
 */
function parseLightModeTokens(css) {
  // Strip everything from the first @media onwards, then find :root { ... }
  const lightOnly = css.split('@media')[0]
  const match = lightOnly.match(/:root\s*\{([^}]*)\}/)
  return match ? parseTokenBlock(match[1]) : {}
}

function applyTokens(content, tokens) {
  return content.replace(/var\((--[\w-]+)\)/g, (match, name) => tokens[name] ?? match)
}

// ── Main ──────────────────────────────────────────────────────────────────────

const tokensCss = readFileSync(resolve(root, '../primr-tokens/tokens.css'), 'utf8')
const tokens = parseLightModeTokens(tokensCss)

const srcDir = join(root, 'src/email-templates')
const outDir = join(root, 'public/email-templates')
mkdirSync(outDir, { recursive: true })

const files = readdirSync(srcDir).filter(f => f.endsWith('.html') || f.endsWith('.txt'))
for (const file of files) {
  const content = readFileSync(join(srcDir, file), 'utf8')
  writeFileSync(join(outDir, file), applyTokens(content, tokens))
}

console.log(`[build-email-templates] ${files.length} templates → public/email-templates/`)

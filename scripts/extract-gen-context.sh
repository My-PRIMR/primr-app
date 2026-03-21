#!/usr/bin/env bash
# Extract context relevant to course/lesson generation for documentation.
# Outputs to /tmp/primr-gen-context.md
set -euo pipefail

OUT="/tmp/primr-gen-context.md"
ROOT="$HOME/dev/PRIMR"
> "$OUT"

echo "Extracting context into $OUT ..."

# ── 1. Non-code documentation files ──────────────────────────────────────────

section() { echo -e "\n\n# === $1 ===\n" >> "$OUT"; }

section "PRIMR Memory Files"
find "$ROOT" -path "*/.claude/projects/*/memory/*.md" -not -path "*/node_modules/*" 2>/dev/null | sort | while read -r f; do
  echo -e "\n## File: ${f#$ROOT/}\n" >> "$OUT"
  cat "$f" >> "$OUT"
done

section "README & CLAUDE.md files"
for f in "$ROOT"/primr-app/README.md "$ROOT"/primr-components/CLAUDE.md "$ROOT"/primr-components/README.md; do
  [ -f "$f" ] || continue
  echo -e "\n## File: ${f#$ROOT/}\n" >> "$OUT"
  cat "$f" >> "$OUT"
done

section "Design specs & plans"
find "$ROOT" -path "*/docs/superpowers/*" -name "*.md" -not -path "*/node_modules/*" 2>/dev/null | sort | while read -r f; do
  echo -e "\n## File: ${f#$ROOT/}\n" >> "$OUT"
  cat "$f" >> "$OUT"
done

section "Root-level docs"
for f in "$ROOT"/master-pitch.md "$ROOT"/dog-food-prompts.md "$ROOT"/TODO.md "$ROOT"/COMPONENT_ROADMAP.md; do
  [ -f "$f" ] || continue
  echo -e "\n## File: ${f#$ROOT/}\n" >> "$OUT"
  cat "$f" >> "$OUT"
done

# ── 2. PDFs → text ──────────────────────────────────────────────────────────

section "PDF documents (converted to text)"
for pdf in "$ROOT"/master-pitch-outline.pdf "$ROOT"/Primr_Deck.pdf; do
  [ -f "$pdf" ] || continue
  echo -e "\n## File: ${pdf#$ROOT/}\n" >> "$OUT"
  if command -v pdftotext &>/dev/null; then
    pdftotext "$pdf" - 2>/dev/null >> "$OUT" || echo "(PDF conversion failed)" >> "$OUT"
  elif command -v textutil &>/dev/null; then
    textutil -convert txt -stdout "$pdf" 2>/dev/null >> "$OUT" || echo "(PDF conversion failed)" >> "$OUT"
  else
    echo "(No PDF-to-text tool found; install poppler: brew install poppler)" >> "$OUT"
  fi
done

# ── 3. Git log for course/lesson generation ──────────────────────────────────

section "Git commit history (course/lesson generation related)"

# primr-app git log
echo -e "\n## primr-app commits\n" >> "$OUT"
cd "$ROOT/primr-app"
git log --all --oneline --no-decorate -60 2>/dev/null >> "$OUT" || true

echo -e "\n## primr-app detailed log (last 30 with diffs summary)\n" >> "$OUT"
git log --all --stat --no-decorate -30 2>/dev/null >> "$OUT" || true

# primr-components git log
echo -e "\n## primr-components commits\n" >> "$OUT"
cd "$ROOT/primr-components"
git log --oneline --no-decorate -20 2>/dev/null >> "$OUT" || true

# primr-root git log
echo -e "\n## primr-root commits\n" >> "$OUT"
cd "$ROOT/primr-root"
git log --oneline --no-decorate -10 2>/dev/null >> "$OUT" || true

# ── 4. Source code comments (grep only comments, not code) ───────────────────

section "Source code comments — course/lesson generation"

extract_comments() {
  local label="$1"; shift
  echo -e "\n## $label\n" >> "$OUT"
  for f in "$@"; do
    [ -f "$f" ] || continue
    echo -e "\n### ${f#$ROOT/}\n" >> "$OUT"
    # Extract: // comments, /* ... */ comments, JSDoc, and function/type signatures
    grep -nE '^\s*(//|/\*|\*|export (async )?function|export (interface|type)|const [A-Z_]+\s*=|^\s*\*/)' "$f" 2>/dev/null >> "$OUT" || true
  done
}

# Core generation files
extract_comments "Course generation engine" \
  "$ROOT/primr-app/src/lib/course-gen.ts" \
  "$ROOT/primr-app/src/lib/video-ingest.ts" \
  "$ROOT/primr-app/src/lib/extract-json.ts" \
  "$ROOT/primr-app/src/lib/email.ts" \
  "$ROOT/primr-app/src/lib/models.ts" \
  "$ROOT/primr-app/src/lib/usage-cap.ts"

# API routes
extract_comments "Course API routes" \
  "$ROOT/primr-app/app/api/courses/parse/route.ts" \
  "$ROOT/primr-app/app/api/courses/route.ts" \
  "$ROOT/primr-app/app/api/courses/[id]/generate/route.ts" \
  "$ROOT/primr-app/app/api/courses/[id]/status/route.ts" \
  "$ROOT/primr-app/app/api/courses/[id]/retry/route.ts" \
  "$ROOT/primr-app/app/api/courses/[id]/route.ts"

extract_comments "Lesson API routes" \
  "$ROOT/primr-app/app/api/lessons/outline/route.ts" \
  "$ROOT/primr-app/app/api/lessons/ingest-video/route.ts" \
  "$ROOT/primr-app/app/api/lessons/route.ts"

# Types
extract_comments "Type definitions" \
  "$ROOT/primr-app/src/types/course.ts" \
  "$ROOT/primr-app/src/types/outline.ts" \
  "$ROOT/primr-components/src/types/index.ts"

# DB schema
extract_comments "Database schema" \
  "$ROOT/primr-app/src/db/schema.ts"

# Wizard / UI (headers and comments only)
extract_comments "Course wizard UI" \
  "$ROOT/primr-app/app/creator/courses/new/CourseWizard.tsx"

# Component files (just types/exports)
extract_comments "Component types (primr-components)" \
  "$ROOT/primr-components/src/components/LessonRenderer/LessonRenderer.tsx" \
  "$ROOT/primr-components/src/components/MediaBlock/MediaBlock.tsx" \
  "$ROOT/primr-components/src/components/Quiz/Quiz.tsx" \
  "$ROOT/primr-components/src/components/FlipCardDeck/FlipCardDeck.tsx" \
  "$ROOT/primr-components/src/components/FillInTheBlank/FillInTheBlank.tsx" \
  "$ROOT/primr-components/src/components/NarrativeBlock/NarrativeBlock.tsx" \
  "$ROOT/primr-components/src/components/StepNavigator/StepNavigator.tsx" \
  "$ROOT/primr-components/src/components/HeroCard/HeroCard.tsx" \
  "$ROOT/primr-components/src/components/DragAndDrop/DragAndDrop.tsx"

# ── 5. System prompt strings (extract full prompt text) ──────────────────────

section "AI system prompts (full text from source)"

echo -e "\n## course-gen.ts prompts\n" >> "$OUT"
cd "$ROOT/primr-app"
# Extract everything between backtick-delimited template strings for prompt constants
python3 -c "
import re, sys
with open('src/lib/course-gen.ts') as f:
    content = f.read()
# Find all const XYZ = \`...\` template strings
for m in re.finditer(r'const\s+(\w+)\s*=\s*\x60(.*?)\x60', content, re.DOTALL):
    name = m.group(1)
    if 'PROMPT' in name or 'SCHEMA' in name:
        print(f'### {name}\n')
        print(m.group(2).strip())
        print()
" >> "$OUT" 2>/dev/null || true

echo -e "\n## video-ingest.ts prompts\n" >> "$OUT"
python3 -c "
import re
with open('src/lib/video-ingest.ts') as f:
    content = f.read()
for m in re.finditer(r'const\s+(\w+)\s*=\s*\x60(.*?)\x60', content, re.DOTALL):
    name = m.group(1)
    if 'PROMPT' in name or 'SCHEMA' in name:
        print(f'### {name}\n')
        print(m.group(2).strip())
        print()
" >> "$OUT" 2>/dev/null || true

echo -e "\n## courses/parse/route.ts prompt functions\n" >> "$OUT"
python3 -c "
import re
with open('app/api/courses/parse/route.ts') as f:
    content = f.read()
for m in re.finditer(r'(function\s+make\w+Prompt.*?return\s*\x60)(.*?)\x60', content, re.DOTALL):
    sig = m.group(1).split('return')[0].strip()
    body = m.group(2).strip()
    print(f'### {sig}\n')
    print(body[:2000])
    print()
" >> "$OUT" 2>/dev/null || true

# ── 6. Package.json summaries ────────────────────────────────────────────────

section "Package dependency context"
for proj in primr-app primr-components primr-internal; do
  pj="$ROOT/$proj/package.json"
  [ -f "$pj" ] || continue
  echo -e "\n## $proj/package.json (dependencies only)\n" >> "$OUT"
  python3 -c "
import json, sys
with open('$pj') as f: p = json.load(f)
for section in ['dependencies', 'devDependencies']:
    deps = p.get(section, {})
    if deps:
        print(f'### {section}')
        for k, v in sorted(deps.items()):
            print(f'  {k}: {v}')
        print()
" >> "$OUT" 2>/dev/null || true
done

# ── Done ─────────────────────────────────────────────────────────────────────

LINES=$(wc -l < "$OUT")
SIZE=$(du -h "$OUT" | cut -f1)
echo "Done! Context extracted to $OUT ($LINES lines, $SIZE)"

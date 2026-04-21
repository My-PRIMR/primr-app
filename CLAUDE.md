# primr-app

Main customer-facing Primr web application. **Next.js 16 + React 19, App Router, webpack mode** (not turbopack). This is where the lesson generator runs, where creators build courses, and where learners play them back.

This app **consumes** the design system — it does not define it. If you need a new color, font, or component primitive, the answer is never "add it here." It's either a new token in `primr-tokens` or a new block in `primr-components`.

## Where the design system lives

| Layer | Package | Role in this app |
|---|---|---|
| Design tokens | `@primr/tokens` → `file:../primr-tokens` | Imported once in `app/globals.css`. Provides every color, font, radius, shadow the app uses. |
| Lesson blocks | `@primr/components` → `file:../primr-components` | Rendered by `/learn/[id]` and `/creator/preview/[id]` via `<LessonRenderer manifest={…} />`. |
| Theme switching | `@primr/tokens/themes.css` | Imported wherever a lesson renders. Lesson root carries `data-primr-theme="<id>"`. |

**Rule: the app reads tokens and renders components. It does not own them.** Creator chrome, dashboards, and upgrade modals use platform tokens (`var(--ink)`, `var(--accent)`, …). Lesson viewing uses a themed subtree. Do not hand-roll dark mode here — themes handle it.

## Commands

```bash
npm run dev          # Dev server on :3000 (webpack mode, + email-template build)
npm run build        # Production build
npm run start        # Start production server
npm run lint         # ESLint
npm run db:generate  # Drizzle — generate migrations from schema.ts
npm run db:migrate   # Apply migrations to DB
npm run db:studio    # Drizzle Studio (DB browser)
```

After changing `../primr-tokens` or `../primr-components`, run `npm install` here to refresh the symlink (usually unnecessary, but a safe reset when styles seem stale).

## Architecture

```
app/                         Next.js App Router
  (shell)/                   Authenticated app chrome (sidebar + topbar wrapper)
  api/
    auth/                    next-auth handlers
    lessons/                 lesson CRUD + AI generation — prompt schemas live here
    courses/                 course management
    invite/                  lesson invitations
    course-invite/           course invitations
    attempts/                lesson attempt tracking
  creator/                   Creator dashboard (route-protected)
    courses/                 course builder
    new/                     new lesson creation flow
    edit/                    lesson editor (consumes isEditor mode of @primr/components)
    preview/                 lesson preview (creator-side LessonRenderer)
  learn/                     Learner view — /learn/[id] plays lessons
  lesson/                    (public lesson reads)
  embed/                     Embeddable lesson player
  my-primr/                  Learner dashboard
  apply-teacher/             Teacher application flow
  upgrade/                   Upgrade / billing
  login/                     Redirects to primr-auth
  components/                App-local UI (not lesson blocks — chrome/modals/menus)
  globals.css                One job: `@import '@primr/tokens/tokens.css';` + reset
  layout.tsx                 Root layout

src/
  auth.ts                    next-auth config (credentials provider, JWT strategy)
  session.ts                 Session helpers
  access.ts                  Plan + role gating
  plans.ts                   Plan definitions (free / pro / enterprise)
  course-gen.ts              Course-level AI generation
  stripe.ts                  Stripe client
  db/
    index.ts                 Drizzle DB client
    schema.ts                Source of truth for DB schema
  email-templates/           Transactional email templates (built via scripts/)
  lib/                       Shared utilities
  monetization/              Plan gating logic
  types/                     TypeScript types

middleware.ts                JWT auth guard — protects /creator, /my-primr, /learn, /api/invite, /api/course-invite
```

## Authentication

primr-app does **not** handle login itself. Unauthenticated requests to protected routes redirect to `PRIMR_AUTH_URL/login?callbackUrl=...`. The `primr_session` JWT cookie is issued by **primr-auth** and verified here in `middleware.ts` using the shared `AUTH_SECRET`.

Protected matcher: `/creator/:path*`, `/my-primr/:path*`, `/learn/:path*`, `/api/invite/:path*`, `/api/course-invite/:path*`.

When adding a new authenticated route: either put it under one of the protected prefixes, or extend the matcher. Do not duplicate auth logic in page components.

## Database

Drizzle ORM + PostgreSQL 16. Schema in `src/db/schema.ts` is the source of truth.

Key tables:
- `users` — roles: `learner | creator | lnd_manager | org_admin`; plans: `free | pro | enterprise`
- `organizations` — multi-tenant
- `lessons` — AI-generated. `manifest: LessonManifest` stored as `jsonb`.
- `lesson_attempts` — learner progress + completion results
- `lesson_invitations` / `course_invitations` — sharing

After schema changes: `npm run db:generate`, review the migration, then `npm run db:migrate`.

## AI / lesson generation

Lives in `app/api/lessons/`. Uses `@anthropic-ai/sdk` + `@ai-sdk/*` providers. Video ingestion via `youtubei.js` (YouTube) and `assemblyai` (transcription). Document ingestion via `mammoth` (docx) and `pdf-parse`.

**The generator produces a `LessonManifest`.** The `LessonManifest` / `BlockConfig` shape is defined in `@primr/components` (`src/types/index.ts`) — this is the hard contract between generation and rendering.

Rules for extending generation:
- A new block type requires two changes: add it to the `BlockConfig['type']` union in `@primr/components/src/types/index.ts`, **and** add its prompt schema here. Both ship together.
- Prompt schemas live under `app/api/lessons/` and import from `@primr/components/lib` (the non-React entry). Never import React components in the API layer.
- `manifest` is the truth. If the AI returns a block type the library doesn't know, `LessonRenderer` will refuse to render it — fail loud, not silent.

## Rendering lessons — the contract

```tsx
import { LessonRenderer } from '@primr/components'
import '@primr/tokens/themes.css' // once, in a top-level layout or page

<article data-primr-theme={lesson.theme ?? 'primr'}>
  <LessonRenderer manifest={manifest} onLessonComplete={handleComplete} />
</article>
```

- Always wrap `LessonRenderer` in an element with `data-primr-theme`. Without it, the lesson falls back to schema defaults — usable but ugly.
- The theme attribute controls **everything visual** inside the subtree: colors, fonts, radii, shadows, flashcard face tones, correct/incorrect colors. Flip it without re-rendering to switch themes.
- Plan gating: pro/enterprise themes are listed in `@primr/tokens/themes.json` with a `tier` field. Read it server-side and refuse to render themes the user's plan doesn't cover.

## Creator editor — `isEditor` mode

Under `/creator/edit/[id]`, lesson blocks render with `isEditor={true}` and `onPropsChange` wired into the save pipeline. Components in `@primr/components` opt into editor affordances via these two props — you don't re-implement editing logic here.

- `onPropsChange(partial)` fires on blur with a partial patch. Merge it into the block's `props` in the manifest and persist.
- Do not bypass this by mutating the DOM. The manifest is the source of truth; edits flow through it.

## App-local styles

- `app/globals.css` exists to import tokens and set a body baseline. That's it.
- CSS Modules for everything local in `app/components/*.module.css` (PageHeader, Paywall, UpgradeModal, UserMenu, …). Same token discipline as the component library — no hex, no hardcoded font names.
- **Do not introduce a CSS-in-JS library.** Do not introduce Tailwind. This is a CSS Modules + tokens app.
- When styling a new chrome element, read first. The pattern for buttons, chips, cards, page headers already exists in `app/components/`.

## Marketing page references

The marketing site (`primr-marketing`) and the `(shell)` chrome are visually aligned but they're separate repos with separate CSS. If a visual needs to be in both (a nav pattern, a CTA button, a pricing chip): it goes in the tokens, or it gets duplicated carefully and reviewed for drift. Do not import cross-repo CSS.

## Footguns

- **Never use turbopack for this app.** `next dev --webpack` is the supported mode. Turbopack has known issues with our CSS Modules setup and with some of the `@primr/components` peer deps. The `dev` script enforces this; don't bypass it.
- **Never import `@primr/tokens/themes.css` into a non-lesson route.** It pulls 11 themes and 3 extra font families; creator chrome pages don't need it and load slower if they get it.
- **Never hardcode a color in a `.module.css`.** Use `var(--ink)`, `var(--accent)`, etc. If a token is missing, add it to `primr-tokens` — a PR in a sibling repo is cheaper than a color that drifts from the system.
- **Never re-implement a lesson block here.** If you find yourself writing a quiz or a flashcard in `app/`, stop. That block belongs in `@primr/components`.
- **Never bypass `LessonRenderer`.** Do not render individual blocks outside the renderer in production — gating, completion tracking, and progress persistence live in the renderer. Direct-block-render is for isolated previews only.
- **Never add a block type locally.** Block types are declared in `@primr/components/src/types/index.ts`. A new type that only this app knows about is dead the moment it hits another consumer.
- **Never store theme-specific styles in `app/components/`.** Theme tokens belong to `primr-tokens`. App components read tokens; they don't define theme-aware CSS.
- **Do not duplicate the `LessonManifest` type in `src/types/`.** Import from `@primr/components`. One definition, one source of truth.
- **Do not introduce a new authenticated route without extending `middleware.ts`.** Page-level guards are easy to forget.

## Env vars

```
DATABASE_URL=          # postgres connection string
AUTH_SECRET=           # JWT secret — MUST match primr-auth
PRIMR_AUTH_URL=        # primr-auth base URL (default http://localhost:3001)
ANTHROPIC_API_KEY=     # Claude API key for lesson generation
PRIMR_DOCS_COURSE_ID=  # Course UUID for the in-product Documentation player (/docs)
```

## Local package dependencies

- `@primr/components` — `file:../primr-components` — lesson blocks.
- `@primr/tokens` — `file:../primr-tokens` — design tokens.

After changing either package, run `npm install` here to refresh the symlink (usually a no-op; run it if styles or types feel out-of-date).

## Summary of contracts this app honors

- Uses `@primr/tokens` for all visual primitives. No hex, no hardcoded fonts, no hardcoded radii.
- Renders lessons exclusively via `<LessonRenderer>` from `@primr/components`.
- Never declares a new `BlockConfig['type']` locally — that goes in `@primr/components`.
- Wraps every lesson in `data-primr-theme`, with the theme value validated against the user's plan tier.
- Keeps authentication centralized in `middleware.ts` + `primr-auth` — never in page components.
- Treats the `LessonManifest` type as the source of truth shared with the AI layer.

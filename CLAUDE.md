# primr-app

Main customer-facing Primr web application. Next.js 16 + React 19, App Router, webpack mode (NOT turbopack).

## Commands

```bash
npm run dev          # Start dev server on :3000 (webpack mode)
npm run build        # Production build
npm run start        # Start production server
npm run lint         # ESLint
npm run db:generate  # Generate Drizzle migrations
npm run db:migrate   # Apply migrations to DB
npm run db:studio    # Open Drizzle Studio (DB browser)
```

## Architecture

```
app/                   # Next.js App Router pages
  api/                 # API routes
    auth/              # next-auth handlers
    lessons/           # lesson CRUD + AI generation
    courses/           # course management
    invite/            # lesson invitations
    attempts/          # lesson attempt tracking
  creator/             # Creator dashboard (route-protected)
    courses/           # course builder
    new/               # new lesson creation
    edit/              # lesson editor
    preview/           # lesson preview
  my-primr/            # Learner dashboard
  learn/               # Lesson player
  login/               # Login page (redirects to primr-auth)
  upgrade/             # Upgrade/billing page
src/
  auth.ts              # NextAuth config (credentials provider, JWT strategy)
  session.ts           # Session helpers
  db/
    index.ts           # Drizzle DB client
    schema.ts          # Full DB schema (source of truth)
  lib/                 # Shared utilities
  types/               # TypeScript types
middleware.ts          # JWT auth guard — protects /creator, /my-primr, /learn, /api/invite
```

## Authentication Flow

primr-app does NOT handle login itself. Unauthenticated requests to protected routes are redirected to `PRIMR_AUTH_URL/login?callbackUrl=...`.

The `primr_session` JWT cookie is issued by **primr-auth** and verified here in `middleware.ts` using the shared `AUTH_SECRET`.

Protected matcher: `/creator/:path*`, `/my-primr/:path*`, `/learn/:path*`, `/api/invite/:path*`, `/api/course-invite/:path*`

## Database

Drizzle ORM + PostgreSQL 16. Schema in `src/db/schema.ts`.

Key tables:
- `users` — roles: `learner | creator | lnd_manager | org_admin`; plans: `free | pro | enterprise`
- `organizations` — multi-tenant
- `lessons` — AI-generated, `manifest: LessonManifest` (jsonb)
- `lesson_attempts` — learner progress
- `lesson_invitations` — sharing

After schema changes: `npm run db:generate` then `npm run db:migrate`.

## AI / Lesson Generation

Uses `@anthropic-ai/sdk`. Lesson generation pipelines are in `app/api/lessons/`. Video ingestion via `youtubei.js` and `assemblyai` for transcription. Document ingestion via `mammoth` (docx) and `pdf-parse`.

## Local Dependencies

- `@primr/components` — `file:../primr-components` — UI component library
- `@primr/tokens` — `file:../primr-tokens` — design tokens CSS

After changing either package, run `npm install` here to update the symlink.

## Environment Variables

```
DATABASE_URL=          # postgres connection string
AUTH_SECRET=           # JWT secret (must match primr-auth)
PRIMR_AUTH_URL=        # primr-auth base URL (default: http://localhost:3001)
ANTHROPIC_API_KEY=     # Claude API key for lesson generation
PRIMR_DOCS_COURSE_ID=  # Course UUID for the in-product Documentation player (/docs)
```

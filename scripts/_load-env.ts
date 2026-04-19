import { config } from 'dotenv'

// Load .env.local first (takes priority) then fall back to .env. Matches
// Next.js's own env-loading convention so scripts see the same DATABASE_URL
// as the app.
config({ path: '.env.local' })
config()

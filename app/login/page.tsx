import { redirect } from 'next/navigation'

export default function LoginPage() {
  redirect(process.env.PRIMR_AUTH_URL ?? 'http://localhost:3001')
}

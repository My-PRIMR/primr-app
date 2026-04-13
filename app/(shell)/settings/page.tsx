import { getSession } from '@/session'
import SettingsClient from './SettingsClient'

export default async function SettingsPage() {
  const session = await getSession()
  return <SettingsClient initialName={session?.user?.name ?? ''} />
}

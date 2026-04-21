import { resolveNavItems } from './resolveNav'
import type { ShellUser } from './shellTypes'

function user(overrides: Partial<ShellUser> = {}): ShellUser {
  return {
    name: 'Test User',
    email: 'test@example.com',
    productRole: 'learner',
    plan: 'free',
    internalRole: null,
    ...overrides,
  } as ShellUser
}

describe('resolveNavItems — upgrade entry', () => {
  test('always renders "Upgrade" label and /upgrade href', () => {
    for (const plan of ['free', 'pro', 'enterprise', 'teacher']) {
      const items = resolveNavItems(user({ plan }))
      const upgrade = items.find(i => i.id === 'upgrade')
      expect(upgrade).toBeDefined()
      expect(upgrade!.label).toBe('Upgrade')
      expect(upgrade!.href).toBe('/upgrade')
      expect(upgrade!.kind).toBe('upgrade')
    }
  })
})

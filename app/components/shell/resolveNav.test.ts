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

describe('resolveNavItems — billing entry label', () => {
  test('uses "Upgrade" for free-plan users', () => {
    const items = resolveNavItems(user({ plan: 'free' }))
    const billing = items.find(i => i.id === 'billing')
    expect(billing).toBeDefined()
    expect(billing!.label).toBe('Upgrade')
    expect(billing!.href).toBe('/upgrade')
  })

  test('uses "Billing" for paid-plan users', () => {
    const items = resolveNavItems(user({ plan: 'pro' }))
    const billing = items.find(i => i.id === 'billing')
    expect(billing).toBeDefined()
    expect(billing!.label).toBe('Billing')
    expect(billing!.href).toBe('/settings/billing')
  })
})

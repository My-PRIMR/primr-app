import { validateThemeId, requiredTier, canUseTheme, DEFAULT_THEME, KNOWN_THEME_IDS } from './themes'

describe('themes helpers', () => {
  test('DEFAULT_THEME is primr', () => {
    expect(DEFAULT_THEME).toBe('primr')
  })

  test('KNOWN_THEME_IDS contains all six themes', () => {
    expect(KNOWN_THEME_IDS.sort()).toEqual(
      ['arctic', 'chalk', 'ember', 'enterprise', 'primr', 'slate'].sort(),
    )
  })

  test('validateThemeId returns the id for known themes', () => {
    expect(validateThemeId('chalk')).toBe('chalk')
    expect(validateThemeId('primr')).toBe('primr')
  })

  test('validateThemeId returns null for unknown themes', () => {
    expect(validateThemeId('bogus')).toBeNull()
    expect(validateThemeId('')).toBeNull()
    expect(validateThemeId(null)).toBeNull()
    expect(validateThemeId(undefined)).toBeNull()
  })

  test('requiredTier reads from manifest', () => {
    expect(requiredTier('primr')).toBe('free')
    expect(requiredTier('slate')).toBe('free')
    expect(requiredTier('chalk')).toBe('pro')
    expect(requiredTier('arctic')).toBe('pro')
    expect(requiredTier('ember')).toBe('pro')
    expect(requiredTier('enterprise')).toBe('enterprise')
  })

  test('canUseTheme allows free users free themes only', () => {
    expect(canUseTheme('primr', 'free')).toBe(true)
    expect(canUseTheme('slate', 'free')).toBe(true)
    expect(canUseTheme('chalk', 'free')).toBe(false)
    expect(canUseTheme('enterprise', 'free')).toBe(false)
  })

  test('canUseTheme treats teacher plan like pro', () => {
    expect(canUseTheme('chalk', 'teacher')).toBe(true)
    expect(canUseTheme('enterprise', 'teacher')).toBe(false)
  })

  test('canUseTheme allows pro users all non-enterprise themes', () => {
    expect(canUseTheme('chalk', 'pro')).toBe(true)
    expect(canUseTheme('enterprise', 'pro')).toBe(false)
  })

  test('canUseTheme allows enterprise users everything', () => {
    expect(canUseTheme('primr', 'enterprise')).toBe(true)
    expect(canUseTheme('chalk', 'enterprise')).toBe(true)
    expect(canUseTheme('enterprise', 'enterprise')).toBe(true)
  })
})

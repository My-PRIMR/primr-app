import { validateThemeId, requiredTier, canUseTheme, DEFAULT_THEME, KNOWN_THEME_IDS } from './themes'

describe('themes helpers', () => {
  test('DEFAULT_THEME is primr', () => {
    expect(DEFAULT_THEME).toBe('primr')
  })

  test('KNOWN_THEME_IDS contains all themes', () => {
    expect(KNOWN_THEME_IDS.sort()).toEqual(
      ['amber','apex','arctic','chalk','ember','enterprise','graphite','primr','primr-dark','signal','slate'].sort(),
    )
  })

  test('amber is free tier', () => {
    expect(requiredTier('amber')).toBe('free')
    expect(canUseTheme('amber', 'free')).toBe(true)
  })

  test('graphite / apex / signal are pro tier', () => {
    for (const id of ['graphite', 'apex', 'signal']) {
      expect(requiredTier(id)).toBe('pro')
      expect(canUseTheme(id, 'free')).toBe(false)
      expect(canUseTheme(id, 'pro')).toBe(true)
    }
  })

  test('validateThemeId accepts primr-dark', () => {
    expect(validateThemeId('primr-dark')).toBe('primr-dark')
  })

  test('primr-dark is free tier and available to free users', () => {
    expect(requiredTier('primr-dark')).toBe('free')
    expect(canUseTheme('primr-dark', 'free')).toBe(true)
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

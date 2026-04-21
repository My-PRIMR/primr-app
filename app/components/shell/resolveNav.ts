import type { ShellUser } from './shellTypes'
import type { NavItemConfig, NavChild } from './SideNavItem'
import navConfig from './nav-config.json'

const CREATOR_ROLES = ['creator', 'lnd_manager', 'org_admin']

type Condition = {
  role?: string
  plan?: string | string[]
  planNot?: string | string[]
  notInternal?: boolean
}

type NavChildJson = {
  label: string
  href: string
  badgeWhen?: Condition
  badgeLabel?: string
  visibleTo?: Condition
}

type NavItemJson = {
  id: string
  label: string
  icon: string
  href?: string
  kind?: string
  visibleTo?: Condition
  badgeWhen?: Condition
  badgeLabel?: string
  children?: NavChildJson[]
}

function matchesCondition(cond: Condition, user: ShellUser): boolean {
  const plan = user.plan ?? 'free'

  if (cond.role === 'creator' && !CREATOR_ROLES.includes(user.productRole)) return false
  if (cond.notInternal && user.internalRole) return false

  if (cond.plan) {
    const plans = Array.isArray(cond.plan) ? cond.plan : [cond.plan]
    if (!plans.includes(plan)) return false
  }

  if (cond.planNot) {
    const plans = Array.isArray(cond.planNot) ? cond.planNot : [cond.planNot]
    if (plans.includes(plan)) return false
  }

  return true
}

export function resolveNavItems(user: ShellUser): NavItemConfig[] {
  const items: NavItemConfig[] = []

  for (const entry of navConfig as NavItemJson[]) {
    if (entry.visibleTo && !matchesCondition(entry.visibleTo, user)) continue

    const children: NavChild[] | undefined = entry.children
      ?.filter(c => !c.visibleTo || matchesCondition(c.visibleTo, user))
      .map(c => ({
        label: c.label,
        href: c.href,
        badge: c.badgeWhen && matchesCondition(c.badgeWhen, user) ? (c.badgeLabel ?? 'Pro') : undefined,
      }))

    const href = entry.href
    const label = entry.label

    const badge = entry.badgeWhen && matchesCondition(entry.badgeWhen, user)
      ? (entry.badgeLabel ?? 'Pro')
      : undefined

    items.push({
      id: entry.id,
      label,
      icon: entry.icon,
      href,
      kind: entry.kind,
      badge,
      children: children && children.length > 0 ? children : undefined,
    })
  }

  return items
}

/**
 * Shared between server pages (which need to call `toPageHeaderUser`)
 * and the `'use client'` PageHeader component (which consumes the type).
 *
 * Lives in its own module without a `'use client'` directive so server
 * components can import the helper without crossing the client boundary.
 */

export interface PageHeaderUser {
  name: string | null
  email: string
  productRole: string
  internalRole?: string | null
  internalUrl?: string
}

/** Picks the fields PageHeader needs from a PrimrSession user. */
export function toPageHeaderUser(user: {
  name: string | null
  email: string
  productRole: string
  internalRole: string | null
}): PageHeaderUser {
  return {
    name: user.name,
    email: user.email,
    productRole: user.productRole,
    internalRole: user.internalRole,
    internalUrl: process.env.PRIMR_INTERNAL_URL ?? 'http://localhost:3004',
  }
}

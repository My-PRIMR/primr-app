/**
 * Shared types for the application shell.
 * No 'use client' — importable from both server and client components.
 */

export interface ShellUser {
  name: string | null
  email: string
  productRole: string
  plan?: string | null
  internalRole?: string | null
  internalUrl?: string
}

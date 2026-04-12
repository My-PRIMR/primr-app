'use client'

import { useEffect, type ReactNode } from 'react'
import { useShellHeader } from './ShellHeaderContext'

/**
 * Render this component inside a page to inject content into the
 * shell header's left and/or right slots.
 *
 * Usage:
 *   <ShellHeaderSlots right={<Link href="/creator/new">+ New lesson</Link>} />
 *
 * Slots are cleared automatically on unmount.
 */
export function ShellHeaderSlots({ left, right }: { left?: ReactNode; right?: ReactNode }) {
  const { setLeftSlot, setRightSlot } = useShellHeader()

  useEffect(() => {
    if (left !== undefined) setLeftSlot(left)
    return () => setLeftSlot(null)
  // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [left])

  useEffect(() => {
    if (right !== undefined) setRightSlot(right)
    return () => setRightSlot(null)
  // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [right])

  return null
}

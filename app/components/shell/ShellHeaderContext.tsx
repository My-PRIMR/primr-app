'use client'

import { createContext, useContext, useState, useCallback, type ReactNode } from 'react'

interface ShellHeaderContextValue {
  leftSlot: ReactNode
  rightSlot: ReactNode
  setLeftSlot: (node: ReactNode) => void
  setRightSlot: (node: ReactNode) => void
}

const ShellHeaderCtx = createContext<ShellHeaderContextValue>({
  leftSlot: null,
  rightSlot: null,
  setLeftSlot: () => {},
  setRightSlot: () => {},
})

export function ShellHeaderProvider({ children }: { children: ReactNode }) {
  const [leftSlot, setLeftSlotState] = useState<ReactNode>(null)
  const [rightSlot, setRightSlotState] = useState<ReactNode>(null)

  const setLeftSlot = useCallback((node: ReactNode) => setLeftSlotState(node), [])
  const setRightSlot = useCallback((node: ReactNode) => setRightSlotState(node), [])

  return (
    <ShellHeaderCtx.Provider value={{ leftSlot, rightSlot, setLeftSlot, setRightSlot }}>
      {children}
    </ShellHeaderCtx.Provider>
  )
}

export function useShellHeader() {
  return useContext(ShellHeaderCtx)
}

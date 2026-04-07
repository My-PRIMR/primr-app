'use client'

import { useState, useRef, useEffect } from 'react'
import Link from 'next/link'
import styles from './ActionsDropdown.module.css'

type DropdownItem =
  | { type: 'link'; label: string; href: string; danger?: boolean }
  | { type: 'button'; label: string; onClick: () => void; danger?: boolean; disabled?: boolean }
  | { type: 'divider' }

interface ActionsDropdownProps {
  items: DropdownItem[]
}

export default function ActionsDropdown({ items }: ActionsDropdownProps) {
  const [open, setOpen] = useState(false)
  const wrapperRef = useRef<HTMLDivElement>(null)

  useEffect(() => {
    if (!open) return

    function handleMouseDown(e: MouseEvent) {
      if (wrapperRef.current && !wrapperRef.current.contains(e.target as Node)) {
        setOpen(false)
      }
    }

    function handleKeyDown(e: KeyboardEvent) {
      if (e.key === 'Escape') setOpen(false)
    }

    document.addEventListener('mousedown', handleMouseDown)
    document.addEventListener('keydown', handleKeyDown)
    return () => {
      document.removeEventListener('mousedown', handleMouseDown)
      document.removeEventListener('keydown', handleKeyDown)
    }
  }, [open])

  return (
    <div ref={wrapperRef} className={styles.wrapper}>
      <button
        className={`${styles.trigger} ${open ? styles.triggerOpen : ''}`}
        onClick={() => setOpen(prev => !prev)}
        aria-haspopup="true"
        aria-expanded={open}
      >
        Actions ▾
      </button>

      {open && (
        <div className={styles.menu} role="menu">
          {items.map((item, i) => {
            if (item.type === 'divider') {
              return <hr key={i} className={styles.divider} />
            }
            if (item.type === 'link') {
              return (
                <Link
                  key={i}
                  href={item.href}
                  className={`${styles.item}${item.danger ? ` ${styles.danger}` : ''}`}
                  role="menuitem"
                  onClick={() => setOpen(false)}
                >
                  {item.label}
                </Link>
              )
            }
            // type === 'button'
            return (
              <button
                key={i}
                className={`${styles.item}${item.danger ? ` ${styles.danger}` : ''}${item.disabled ? ` ${styles.disabled}` : ''}`}
                role="menuitem"
                disabled={item.disabled}
                onClick={() => {
                  if (item.disabled) return
                  setOpen(false)
                  item.onClick()
                }}
              >
                {item.label}
              </button>
            )
          })}
        </div>
      )}
    </div>
  )
}

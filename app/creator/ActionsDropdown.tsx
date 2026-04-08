'use client'

import { useState, useRef, useEffect } from 'react'
import { createPortal } from 'react-dom'
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
  const [menuPos, setMenuPos] = useState({ top: 0, right: 0 })
  const wrapperRef = useRef<HTMLDivElement>(null)
  const menuRef = useRef<HTMLDivElement>(null)
  const btnRef = useRef<HTMLButtonElement>(null)

  useEffect(() => {
    if (!open) return

    function handleMouseDown(e: MouseEvent) {
      const target = e.target as Node
      if (
        wrapperRef.current && !wrapperRef.current.contains(target) &&
        menuRef.current && !menuRef.current.contains(target)
      ) {
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

  function handleOpen() {
    if (btnRef.current) {
      const rect = btnRef.current.getBoundingClientRect()
      setMenuPos({
        top: rect.bottom + 4,
        right: window.innerWidth - rect.right,
      })
    }
    setOpen(prev => !prev)
  }

  return (
    <div ref={wrapperRef} className={styles.wrapper}>
      <button
        ref={btnRef}
        className={`${styles.trigger} ${open ? styles.triggerOpen : ''}`}
        onClick={handleOpen}
        aria-haspopup="menu"
        aria-expanded={open}
      >
        Actions <span aria-hidden="true">▾</span>
      </button>

      {open && createPortal(
        <div
          ref={menuRef}
          className={styles.menu}
          role="menu"
          style={{ position: 'fixed', top: menuPos.top, right: menuPos.right }}
        >
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
        </div>,
        document.body
      )}
    </div>
  )
}

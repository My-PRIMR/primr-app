'use client'

import React from 'react'

type Props = { children: React.ReactNode }
type State = { hasError: boolean; logged: boolean }

export default class ResultsTabBoundary extends React.Component<Props, State> {
  state: State = { hasError: false, logged: false }

  static getDerivedStateFromError(): Partial<State> {
    return { hasError: true }
  }

  componentDidCatch(error: Error, info: React.ErrorInfo) {
    if (this.state.logged) return
    this.setState({ logged: true })
    const payload = {
      message: error?.message ?? String(error),
      name: error?.name,
      stack: error?.stack?.slice(0, 2000),
      componentStack: info?.componentStack?.slice(0, 1000),
      ua: typeof navigator !== 'undefined' ? navigator.userAgent : 'unknown',
    }
    fetch('/api/log-error', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify(payload),
    }).catch(() => {})
  }

  render() {
    if (this.state.hasError) {
      return (
        <div style={{ padding: '2rem', color: 'var(--ink-muted, #888)', fontSize: '14px' }}>
          Results could not be displayed. The error has been logged.
        </div>
      )
    }
    return this.props.children
  }
}

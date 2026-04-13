'use client'

import { useEffect } from 'react'

export default function EmbedAuthCallback() {
  useEffect(() => {
    if (window.opener) {
      window.opener.postMessage({ type: 'primr-auth-complete' }, '*')
      window.close()
    }
  }, [])

  return (
    <div style={{
      display: 'flex',
      alignItems: 'center',
      justifyContent: 'center',
      height: '100vh',
      fontFamily: 'system-ui, sans-serif',
      color: '#666',
    }}>
      <p>You are signed in. You can close this tab.</p>
    </div>
  )
}

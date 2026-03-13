import type { Metadata } from 'next'
import './globals.css'

export const metadata: Metadata = {
  title: 'Primr — The platform for interactive learning',
  description: 'Turn a plain markdown file into a rich, interactive lesson in minutes.',
}

export default function RootLayout({ children }: { children: React.ReactNode }) {
  return (
    <html lang="en">
      <body>{children}</body>
    </html>
  )
}

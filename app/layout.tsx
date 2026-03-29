import type { Metadata } from 'next'
import './globals.css'

export const metadata: Metadata = {
  title: 'Primr — The platform for interactive learning',
  description: 'Turn a plain markdown file into a rich, interactive lesson in minutes.',
}

export default function RootLayout({ children }: { children: React.ReactNode }) {
  return (
    <html lang="en" suppressHydrationWarning>
      <head>
        {/* Apply stored theme before first paint to prevent flash */}
        <script dangerouslySetInnerHTML={{ __html: `
          (function(){
            try {
              // Migrate old key to new key
              var oldKey = localStorage.getItem('primr-theme');
              if (oldKey && !localStorage.getItem('primr_theme_preference')) {
                localStorage.setItem('primr_theme_preference', oldKey);
                localStorage.removeItem('primr-theme');
              }
              // Apply stored theme
              var t = localStorage.getItem('primr_theme_preference');
              if (t === 'dark' || t === 'light') document.documentElement.setAttribute('data-theme', t);
            } catch(e) {}
          })();
        `}} />
      </head>
      <body>{children}</body>
    </html>
  )
}

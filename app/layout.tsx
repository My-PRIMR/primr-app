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
              // Check for theme parameter in URL (from parent iframe)
              var urlParams = new URLSearchParams(window.location.search);
              var paramTheme = urlParams.get('theme');

              // Migrate old key to new key
              var oldKey = localStorage.getItem('primr-theme');
              if (oldKey && !localStorage.getItem('primr_theme_preference')) {
                localStorage.setItem('primr_theme_preference', oldKey);
                localStorage.removeItem('primr-theme');
              }

              // Apply theme: prioritize URL param, then stored preference, then system
              var t = paramTheme || localStorage.getItem('primr_theme_preference');
              if (t === 'dark' || t === 'light') document.documentElement.setAttribute('data-theme', t);
            } catch(e) {}
          })();
        `}} />
      </head>
      <body>{children}</body>
    </html>
  )
}

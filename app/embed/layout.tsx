import '@primr/tokens'

export const metadata = {
  robots: 'noindex, nofollow',
}

export default function EmbedLayout({ children }: { children: React.ReactNode }) {
  return (
    <html lang="en" suppressHydrationWarning>
      <head />
      <body style={{ margin: 0, padding: 0, overflow: 'auto' }}>
        {children}
        <EmbedBridge />
      </body>
    </html>
  )
}

function EmbedBridge() {
  return (
    <script
      dangerouslySetInnerHTML={{
        __html: `
(function() {
  var last = 0;
  var ro = new ResizeObserver(function() {
    var h = document.body.scrollHeight;
    if (h !== last) {
      last = h;
      window.parent.postMessage({ type: 'primr-resize', height: h }, '*');
    }
  });
  ro.observe(document.body);

  window.addEventListener('message', function(e) {
    if (e.data && e.data.type === 'primr-theme-change') {
      var theme = e.data.theme;
      if (theme === 'light' || theme === 'dark') {
        document.documentElement.setAttribute('data-theme', theme);
      }
    }
  });

  window.parent.postMessage({
    type: 'primr-ready',
    contentType: document.body.dataset.embedType || 'lesson',
    contentId: document.body.dataset.embedId || ''
  }, '*');

  // Also support legacy 'theme-change' from existing marketing embed
  window.addEventListener('message', function(e) {
    if (e.data && e.data.type === 'theme-change') {
      var theme = e.data.theme;
      if (theme === 'light' || theme === 'dark') {
        document.documentElement.setAttribute('data-theme', theme);
      }
    }
  });
})();
        `,
      }}
    />
  )
}

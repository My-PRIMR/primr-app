import '@primr/tokens'
import '@primr/tokens/themes.css'

export const metadata = {
  robots: 'noindex, nofollow',
}

export default function EmbedLayout({ children }: { children: React.ReactNode }) {
  return (
    <>
      {children}
      <EmbedBridge />
    </>
  )
}

function EmbedBridge() {
  return (
    <script
      dangerouslySetInnerHTML={{
        __html: `
(function() {
  var KNOWN_THEMES = ['primr','primr-dark','slate','chalk','arctic','ember','enterprise'];
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
      if (KNOWN_THEMES.indexOf(theme) !== -1) {
        document.body.setAttribute('data-primr-theme', theme);
      }
    }
  });

  window.parent.postMessage({
    type: 'primr-ready',
    contentType: document.body.dataset.embedType || 'lesson',
    contentId: document.body.dataset.embedId || ''
  }, '*');
})();
        `,
      }}
    />
  )
}

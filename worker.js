// Cloudflare Worker - Notion Page Proxy
// This fetches the Notion page and serves it without iframe-blocking headers

const NOTION_URL = 'https://wiggly-fir-b9a.notion.site/Shopify-HQ-Internal-2a913c836ea680dba839c76eee32d4dc';

export default {
  async fetch(request) {
    const url = new URL(request.url);

    // Handle the root path - serve the viewer page
    if (url.pathname === '/' || url.pathname === '') {
      return new Response(getViewerHTML(), {
        headers: { 'Content-Type': 'text/html' }
      });
    }

    // Handle /notion path - proxy the Notion page
    if (url.pathname === '/notion' || url.pathname.startsWith('/notion')) {
      return proxyNotion(request);
    }

    // Proxy all other requests to Notion (for assets, scripts, etc.)
    return proxyNotion(request);
  }
};

async function proxyNotion(request) {
  const url = new URL(request.url);

  // Build the Notion URL
  let notionUrl;
  if (url.pathname === '/notion' || url.pathname === '/') {
    notionUrl = NOTION_URL;
  } else {
    // Proxy sub-resources (CSS, JS, images, API calls)
    notionUrl = 'https://wiggly-fir-b9a.notion.site' + url.pathname + url.search;
  }

  // Fetch from Notion
  const response = await fetch(notionUrl, {
    method: request.method,
    headers: {
      'User-Agent': request.headers.get('User-Agent') || 'Mozilla/5.0',
      'Accept': request.headers.get('Accept') || '*/*',
      'Accept-Language': request.headers.get('Accept-Language') || 'en-US,en;q=0.9',
    },
    redirect: 'follow'
  });

  // Clone the response and modify headers
  const newHeaders = new Headers(response.headers);

  // Remove headers that block iframe embedding
  newHeaders.delete('X-Frame-Options');
  newHeaders.delete('Content-Security-Policy');

  // Add CORS headers
  newHeaders.set('Access-Control-Allow-Origin', '*');

  // Get the content type
  const contentType = response.headers.get('Content-Type') || '';

  // If it's HTML, we need to modify the base URL for resources
  if (contentType.includes('text/html')) {
    let html = await response.text();

    // Inject CSS to disable interactions
    const disableInteractionCSS = `
      <style>
        /* Disable all pointer interactions */
        * {
          pointer-events: none !important;
          user-select: none !important;
          -webkit-user-select: none !important;
          -moz-user-select: none !important;
          -ms-user-select: none !important;
        }
        /* Hide any interactive elements */
        [contenteditable],
        button:not(.notion-page-content button),
        input,
        textarea,
        a[href] {
          cursor: default !important;
        }
        /* Hide Notion's UI controls */
        .notion-topbar-share-menu,
        .notion-topbar-more-button,
        .notion-page-controls,
        .notion-sidebar,
        .notion-overlay-container {
          display: none !important;
        }
      </style>
    `;

    // Inject the CSS before </head>
    html = html.replace('</head>', disableInteractionCSS + '</head>');

    return new Response(html, {
      status: response.status,
      headers: newHeaders
    });
  }

  return new Response(response.body, {
    status: response.status,
    headers: newHeaders
  });
}

function getViewerHTML() {
  return `<!DOCTYPE html>
<html lang="en">
<head>
    <meta charset="UTF-8">
    <meta name="viewport" content="width=device-width, initial-scale=1.0">
    <title>Shopify HQ Internal - View Only</title>
    <style>
        * { margin: 0; padding: 0; box-sizing: border-box; }
        html, body { width: 100%; height: 100%; overflow: hidden; }
        .viewer-container { position: relative; width: 100%; height: 100%; }
        .notion-frame {
            width: 100%;
            height: 100%;
            border: none;
            pointer-events: none;
        }
        .interaction-blocker {
            position: absolute;
            top: 0; left: 0;
            width: 100%; height: 100%;
            z-index: 1000;
            cursor: default;
            background: transparent;
        }
        .view-only-badge {
            position: fixed;
            top: 10px; right: 10px;
            z-index: 1001;
            background: rgba(0, 0, 0, 0.7);
            color: white;
            padding: 8px 16px;
            border-radius: 4px;
            font-family: -apple-system, BlinkMacSystemFont, 'Segoe UI', Roboto, sans-serif;
            font-size: 12px;
            pointer-events: none;
        }
    </style>
</head>
<body>
    <div class="viewer-container">
        <div class="interaction-blocker"></div>
        <iframe class="notion-frame" src="/notion" title="View Only"></iframe>
        <div class="view-only-badge">View Only</div>
    </div>
    <script>
        document.addEventListener('contextmenu', e => e.preventDefault());
        document.addEventListener('dragstart', e => e.preventDefault());
        // Auto-refresh iframe every 30 seconds for real-time updates
        setInterval(() => {
            document.querySelector('.notion-frame').src = '/notion?t=' + Date.now();
        }, 30000);
    </script>
</body>
</html>`;
}

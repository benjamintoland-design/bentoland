import core from './index.js';
import {handleJournalRequest} from './journal.js';

function fixPublicGalleryHtml(html) {
  return html
    .replace("const cats=[['wildlife','Wildlife','Birds / animals / nature']", "const cats=[['animals','Aminals','Birds / animals / nature']")
    .replace('<button data-cat="wildlife">Wildlife <span>View →</span></button>', '<button data-cat="animals">Aminals <span>View →</span></button>')
    .replace('wildlife, architecture, landscapes, details, and whatever else catches my eye.', 'animals, architecture, landscapes, details, and whatever else catches my eye.');
}

export default {
  async fetch(request, env, ctx) {
    const journalResponse = await handleJournalRequest(request, env);
    if (journalResponse) return journalResponse;

    const url = new URL(request.url);
    if (request.method === 'GET' && (url.pathname === '/' || url.pathname === '/index.html')) {
      const assetResponse = await env.ASSETS.fetch(request);
      if (assetResponse.ok) {
        const headers = new Headers(assetResponse.headers);
        headers.set('content-type', 'text/html; charset=utf-8');
        headers.set('cache-control', 'no-store');
        return new Response(fixPublicGalleryHtml(await assetResponse.text()), {
          status: assetResponse.status,
          statusText: assetResponse.statusText,
          headers
        });
      }
    }

    return core.fetch(request, env, ctx);
  }
};

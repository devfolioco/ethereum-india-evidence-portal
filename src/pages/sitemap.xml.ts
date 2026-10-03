import { getCollection } from 'astro:content';
import type { APIRoute } from 'astro';

// ponytail: hand-rolled instead of @astrojs/sitemap; one list of paths, no extra dependency.
export const GET: APIRoute = async ({ site }) => {
  const modules = await getCollection('briefing');
  const paths = [
    '/',
    '/briefing',
    ...modules.map((m) => `/briefing/${m.data.letter}`).sort(),
    '/briefing/ledger',
    '/briefing/reconciliation',
    '/dinner',
    '/privacy',
  ];
  const urls = paths.map((p) => `  <url><loc>${new URL(p, site)}</loc></url>`).join('\n');
  return new Response(
    `<?xml version="1.0" encoding="UTF-8"?>\n<urlset xmlns="http://www.sitemaps.org/schemas/sitemap/0.9">\n${urls}\n</urlset>\n`,
    { headers: { 'Content-Type': 'application/xml' } }
  );
};

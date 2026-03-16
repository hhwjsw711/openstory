import { createFileRoute } from '@tanstack/react-router';
import { SITE_CONFIG } from '@/lib/marketing/constants';

const SITEMAP_PAGES = [
  '/login',
  '/sequences',
  '/sequences/new',
  '/talent',
  '/locations',
] as const;

function buildSitemap(): string {
  const urls = SITEMAP_PAGES.map(
    (path) => `  <url>
    <loc>${SITE_CONFIG.url}${path}</loc>
  </url>`
  ).join('\n');

  return `<?xml version="1.0" encoding="UTF-8"?>
<urlset xmlns="http://www.sitemaps.org/schemas/sitemap/0.9">
${urls}
</urlset>`;
}

export const Route = createFileRoute('/sitemap.xml')({
  server: {
    handlers: {
      GET: async () => {
        return new Response(buildSitemap(), {
          status: 200,
          headers: {
            'Content-Type': 'application/xml; charset=utf-8',
            'Cache-Control': 'public, max-age=86400',
          },
        });
      },
    },
  },
});

import { createFileRoute } from '@tanstack/react-router';
import { json } from '@tanstack/react-start';

export const Route = createFileRoute('/api/test/image')({
  server: {
    handlers: {
      GET: async ({ request }) => {
        if (process.env.E2E_TEST !== 'true') {
          return json({ error: 'Not found' }, { status: 404 });
        }

        const url = new URL(request.url);
        const w = Math.min(Number(url.searchParams.get('w')) || 200, 4096);
        const h = Math.min(Number(url.searchParams.get('h')) || 200, 4096);
        const label = url.searchParams.get('label') || `${w}\u00D7${h}`;
        const fontSize = Math.max(12, Math.min(w, h) / 8);

        const svg = `<svg xmlns="http://www.w3.org/2000/svg" width="${w}" height="${h}" viewBox="0 0 ${w} ${h}">
  <defs>
    <linearGradient id="g" x1="0%" y1="0%" x2="100%" y2="100%">
      <stop offset="0%" stop-color="#4F46E5"/>
      <stop offset="100%" stop-color="#7C3AED"/>
    </linearGradient>
  </defs>
  <rect width="${w}" height="${h}" fill="url(#g)"/>
  <text x="50%" y="50%" text-anchor="middle" dominant-baseline="middle"
        font-family="system-ui,sans-serif" font-size="${fontSize}" fill="white" opacity="0.8">
    ${label}
  </text>
</svg>`;

        return new Response(svg, {
          headers: {
            'Content-Type': 'image/svg+xml',
            'Cache-Control': 'public, max-age=31536000, immutable',
          },
        });
      },
    },
  },
});

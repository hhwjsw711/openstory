// vite.config.ts
import path from 'path';
import { defineConfig } from 'vite';
import { tanstackStart } from '@tanstack/react-start/plugin/vite';
import { nitro } from 'nitro/vite';
import { cloudflare } from '@cloudflare/vite-plugin';

import viteReact from '@vitejs/plugin-react';
import tsconfigPaths from 'vite-tsconfig-paths';
import tailwindcss from '@tailwindcss/vite';

const vidstackPath = path.resolve('node_modules/@vidstack/react');
export default defineConfig({
  // Prevent Vite from replacing process.env at build time
  // This allows workerd's nodejs_compat_populate_process_env to work

  server: {
    port: 3000,
    host: true, // Listen on all interfaces for QStash Docker to reach via host.docker.internal
    allowedHosts: ['localhost', '127.0.0.1', 'host.docker.internal'],
  },
  resolve: {
    alias: process.env.BUILD_CLOUDFLARE
      ? [
          {
            find: /^@vidstack\/react\/player\/layouts\/default$/,
            replacement: path.join(
              vidstackPath,
              'prod/player/vidstack-default-layout.js'
            ),
          },
          {
            find: /^@vidstack\/react$/,
            replacement: path.join(vidstackPath, 'prod/vidstack.js'),
          },
        ]
      : undefined,
  },
  plugins: [
    tsconfigPaths(),
    tailwindcss(),
    process.env.BUILD_CLOUDFLARE
      ? cloudflare({ viteEnvironment: { name: 'ssr' } })
      : nitro(),
    // Enables Vite to resolve imports using path aliases.
    tanstackStart({
      srcDirectory: 'src', // This is the default
      router: {
        // Specifies the directory TanStack Router uses for your routes.
        routesDirectory: 'routes', // Defaults to "routes", relative to srcDirectory
      },
    }),
    viteReact(),
  ],
  ssr: {
    noExternal: ['@upstash/realtime', '@vidstack/react'],
  },
});

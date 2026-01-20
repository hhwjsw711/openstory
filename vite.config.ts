// vite.config.ts
import path from 'path';
import { defineConfig, type Plugin } from 'vite';
import { tanstackStart } from '@tanstack/react-start/plugin/vite';
import { nitro } from 'nitro/vite';
import { cloudflare } from '@cloudflare/vite-plugin';
import { visualizer } from 'rollup-plugin-visualizer';

import viteReact from '@vitejs/plugin-react';
import tsconfigPaths from 'vite-tsconfig-paths';
import tailwindcss from '@tailwindcss/vite';

// Plugin to display the tunnel URL in the CLI
function tunnelDisplay(): Plugin {
  return {
    name: 'tunnel-display',
    configureServer(server) {
      const _printUrls = server.printUrls.bind(server);
      server.printUrls = () => {
        _printUrls();
        if (process.env.APP_URL) {
          console.log(
            `  \x1b[32m➜\x1b[0m  \x1b[1mTunnel:\x1b[0m  \x1b[36m${process.env.APP_URL}\x1b[0m`
          );
        }
      };
    },
  };
}

// Enable tree-shaking debugging: DEBUG_TREESHAKE=1 enables treeshake, DEBUG_VISUALIZER=1 adds visualizer
const debugTreeshake = process.env.DEBUG_TREESHAKE_OFF !== '1';
const debugVisualizer = process.env.DEBUG_VISUALIZER === '1';

const vidstackPath = path.resolve('node_modules/@vidstack/react');

export default defineConfig({
  // Prevent Vite from replacing process.env at build time
  // This allows workerd's nodejs_compat_populate_process_env to work

  server: {
    port: 3000,
    host: true, // Listen on all interfaces for QStash Docker to reach via host.docker.internal
    allowedHosts: [
      'localhost',
      '127.0.0.1',
      'host.docker.internal',
      ...(process.env.APP_URL ? [new URL(process.env.APP_URL).hostname] : []),
    ],
  },
  preview: {
    port: 3000, // Preview server port (for cf:preview)
    host: true,
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
      : nitro({
          rollupConfig: {
            // Default: treeshake disabled due to Nitro bug (see docs/nitro-treeshake-bug-report.md)
            // Enable with DEBUG_TREESHAKE=1 for debugging
            treeshake: debugTreeshake,
            plugins: debugVisualizer
              ? [
                  visualizer({
                    filename: '.output/stats-nitro.html',
                    open: false,
                    gzipSize: true,
                    brotliSize: true,
                    template: 'treemap', // 'sunburst', 'treemap', 'network'
                  }),
                ]
              : [],
          },
        }),
    // Enables Vite to resolve imports using path aliases.
    tanstackStart({
      srcDirectory: 'src', // This is the default
      router: {
        // Specifies the directory TanStack Router uses for your routes.
        routesDirectory: 'routes', // Defaults to "routes", relative to srcDirectory
      },
    }),
    viteReact(),
    tunnelDisplay(),
  ],
  ssr: {
    noExternal: ['@upstash/realtime', '@vidstack/react'],
  },
});

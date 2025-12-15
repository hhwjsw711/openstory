import { defineConfig } from 'vite';
import { tanstackStart } from '@tanstack/react-start/plugin/vite';
import viteReact from '@vitejs/plugin-react';
import viteTsConfigPaths from 'vite-tsconfig-paths';
import tailwindcss from '@tailwindcss/vite';
import { nitro } from 'nitro/vite';

const config = defineConfig({
  plugins: [
    // this is the plugin that enables path aliases
    viteTsConfigPaths({
      projects: ['./tsconfig.json'],
    }),
    tailwindcss(),
    tanstackStart(),
    nitro({
      // Disable tree-shaking to prevent bundler from incorrectly removing exports
      rollupConfig: {
        treeshake: false,
      },
    }),
    viteReact(),
  ],
  ssr: {
    // Ensure these packages are bundled, not externalized
    noExternal: ['@upstash/realtime'],
  },
});

export default config;

import tailwindcss from '@tailwindcss/vite';
import react from '@vitejs/plugin-react';
import path from 'path';
import {defineConfig, Plugin} from 'vite';
import {VitePWA} from 'vite-plugin-pwa';

function disableHmrWebSocketPlugin(): Plugin {
  return {
    name: 'disable-hmr-websocket',
    apply: 'serve',
    enforce: 'post',
    transform(code, id) {
      if (!id.replace(/\\/g, '/').includes('vite/dist/client/client.mjs')) {
        return null;
      }
      if (!code.includes('createWebSocketModuleRunnerTransport')) {
        return null;
      }
      const patched = code.replace(
        /const createWebSocketModuleRunnerTransport = \(options\) => \{[\s\S]*?return \{[\s\S]*?send\(data\) \{[\s\S]*?\}\s*\};\s*\};/,
        'const createWebSocketModuleRunnerTransport = () => ({ connect() {}, disconnect() {}, send() {} });'
      );
      return patched !== code ? { code: patched, map: null } : null;
    },
  };
}

export default defineConfig(() => {
  return {
    plugins: [
      disableHmrWebSocketPlugin(),
      react(),
      tailwindcss(),
      VitePWA({
        strategies: 'injectManifest',
        srcDir: 'src',
        filename: 'sw.ts',
        registerType: 'autoUpdate',
        includeAssets: ['icon.svg', 'apple-touch-icon.png', 'pwa-192x192.png', 'pwa-512x512.png'],
        manifest: {
          id: '/',
          name: 'PMES-AGR Dosso - Micro-Finance PWA',
          short_name: 'PMES-AGR',
          description: 'Micro-Finance professionnelle de la région de Dosso (Niger) - Espace Membre & Admin',
          theme_color: '#0f172a',
          background_color: '#0f172a',
          display: 'standalone',
          start_url: '/',
          scope: '/',
          icons: [
            {
              src: '/pwa-192x192.png',
              sizes: '192x192',
              type: 'image/png',
              purpose: 'any',
            },
            {
              src: '/pwa-512x512.png',
              sizes: '512x512',
              type: 'image/png',
              purpose: 'any',
            },
            {
              src: '/pwa-512x512.png',
              sizes: '512x512',
              type: 'image/png',
              purpose: 'maskable',
            },
            {
              src: '/icon.svg',
              sizes: 'any',
              type: 'image/svg+xml',
              purpose: 'any',
            },
          ],
        },
        injectManifest: {
          maximumFileSizeToCacheInBytes: 10 * 1024 * 1024,
          globPatterns: ['**/*.{js,css,html,ico,png,svg,woff,woff2}'],
        },
        devOptions: {
          enabled: true,
          type: 'module',
        },
      }),
    ],
    resolve: {
      alias: {
        '@': path.resolve(__dirname, '.'),
      },
    },
    server: {
      hmr: false as const,
      ws: false as const,
      watch: null,
    },
  };
});

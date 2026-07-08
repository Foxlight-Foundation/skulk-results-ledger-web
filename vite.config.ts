import { fileURLToPath, URL } from 'node:url';
import react from '@vitejs/plugin-react';
import { defineConfig } from 'vite';

// Static site: no dev server proxy, no backend. Generated data lives in
// `public/data/` (produced by `npm run import`) so Vite serves it as static
// assets and it ships verbatim in the production build.
export default defineConfig({
  plugins: [react()],
  resolve: {
    alias: {
      '@': fileURLToPath(new URL('./src', import.meta.url)),
    },
  },
  // Base is overridable for GitHub Pages / subpath deploys via DEPLOY_BASE.
  base: process.env.DEPLOY_BASE ?? '/',
  server: {
    host: true, // bind 0.0.0.0 so the dev server is reachable over Tailscale
    // Vite blocks requests whose Host header is a non-localhost domain; allow
    // the tailnet MagicDNS suffix so a `*.ts.net` name resolves.
    allowedHosts: ['.ts.net'],
  },
});

import { defineConfig } from 'vite'
import react from '@vitejs/plugin-react'

// Standalone static web build of the renderer, for sharing via GitHub Pages.
// The Electron app still builds with electron.vite.config.ts; this config just
// bundles the same React renderer into a self-contained static site.
//
// base: './' makes all asset URLs relative, so the site works whether it is
// served from a domain root or from a project sub-path
// (https://<user>.github.io/<repo>/) without knowing the repo name in advance.
export default defineConfig({
  root: '.',
  base: './',
  plugins: [react()],
  build: {
    outDir: 'dist-web',
    emptyOutDir: true
  }
})

import { defineConfig } from 'vite';

// `base` is set so the built site works when served from a GitHub Pages
// project subpath (https://<org>.github.io/<repo>/). Override with the
// CARVE_BASE env var if the repo name differs.
const base = process.env.CARVE_BASE ?? './';

export default defineConfig({
  base,
  build: {
    outDir: 'dist',
    sourcemap: false,
  },
});

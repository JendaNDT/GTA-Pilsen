import { defineConfig } from 'vite';

// base './' = hra funguje na jakékoli adrese (Vercel, GitHub Pages, podsložka)
export default defineConfig({
  base: './',
  build: { chunkSizeWarningLimit: 900 },
});

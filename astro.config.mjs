import { defineConfig } from 'astro/config';
import tailwind from '@astrojs/tailwind';
import vercel from '@astrojs/vercel';

export default defineConfig({
  site: 'https://www.grundschule-paul-klee.de',
  integrations: [tailwind()],
  // Site bleibt statisch; einzelne API-Routen rendern serverseitig
  // (export const prerender = false) — dafür der Vercel-Adapter.
  output: 'static',
  adapter: vercel()
});

import { defineConfig } from 'astro/config';
import tailwind from '@astrojs/tailwind';
import vercel from '@astrojs/vercel';

export default defineConfig({
  site: 'https://www.pks-foerderverein.de',
  integrations: [tailwind()],
  // Site bleibt statisch; einzelne API-Routen rendern serverseitig
  // (export const prerender = false) — dafür der Vercel-Adapter.
  output: 'static',
  adapter: vercel(),
  // Astros CSRF-Origin-Check vergleicht gegen den internen Request-Host
  // (auf Vercel = localhost) und würde dadurch auch echte Formular-POSTs
  // mit 403 abweisen. Absicherung erfolgt hier über Honeypot + die
  // signierte Vorstands-Freigabe (Token), daher Check aus.
  security: { checkOrigin: false }
});

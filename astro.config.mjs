import { defineConfig } from 'astro/config';
import tailwind from '@astrojs/tailwind';

export default defineConfig({
  site: 'https://www.grundschule-paul-klee.de',
  integrations: [tailwind()],
  output: 'static'
});

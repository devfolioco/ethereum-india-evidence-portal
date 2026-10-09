import { defineConfig } from 'astro/config';
import vercel from '@astrojs/vercel';

export default defineConfig({
  site: 'https://institutions.ethindia.co',
  output: 'static',
  adapter: vercel(),
});

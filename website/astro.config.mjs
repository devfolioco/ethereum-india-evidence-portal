import { defineConfig } from 'astro/config';
import vercel from '@astrojs/vercel';

export default defineConfig({
  site: 'https://institutions.ethindia.co',
  output: 'static',
  adapter: vercel(),
  vite: {
    build: {
      rolldownOptions: {
        treeshake: {
          // @astrojs/vercel 11.0.13 imports runtime constants from its build entry.
          // Drop only the unused external Rolldown import this leaves in the function;
          // its native build bindings are not packaged for the server runtime.
          moduleSideEffects: (id, external) => external && id === 'rolldown' ? false : undefined,
        },
      },
    },
  },
});

import { defineConfig } from 'astro/config';
import less from '@astrojs/renderer-less';

export default defineConfig({
  renderers: [less()],
  vite: {
    logLevel: 'error', // hides warnings
  },
});
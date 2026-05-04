import { createRequire } from 'node:module';
import { defineConfig } from 'vite';

const require = createRequire(import.meta.url);
const { name } = require('./package.json');

export default defineConfig(({ command }) => ({
  base: `/${name}/`,
  server: {
    hot: true,
    open: true,
    port: 8080,
    strictPort: false
  },
  build: {
    emptyOutDir: true,
    outDir: 'dist',
    minify: 'terser',
    rollupOptions: {
      input: {
        index: './index.html'
      },
      output: {
        entryFileNames: `js/${name}.min.js`,
        chunkFileNames: `js/${name}.[name].js`,
        assetFileNames: assetInfo => {
          if (assetInfo.name?.endsWith('.css')) return `css/${name}.min.css`;
          return `assets/[name][extname]`;
        }
      }
    },
    sourcemap: true,
    terserOptions: {
      compress: {
        drop_console: command === 'build'
      }
    }
  }
}));

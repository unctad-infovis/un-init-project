import { defineConfig } from 'vite';
import react from '@vitejs/plugin-react';
import { resolve } from 'path';
import { copyFileSync, mkdirSync, cpSync } from 'fs';
import { createRequire } from 'module';

const require = createRequire(import.meta.url);
const { name } = require('./package.json');

export default defineConfig(({ command }) => ({
  plugins: [
    react(),
    {
      name: 'copy-assets',
      closeBundle() {
        try { cpSync('assets/img', 'public/assets/img', { recursive: true }); } catch {}
        try {
          mkdirSync('public/assets/data', { recursive: true });
          copyFileSync('assets/data/data.json', 'public/assets/data/data.json');
        } catch {}
        try { cpSync('src/font', 'public/font', { recursive: true }); } catch {}
        try { copyFileSync('favicon.png', 'public/favicon.png'); } catch {}
      }
    }
  ],
  server: {
    hot: true,
    open: true
  },
  build: {
    outDir: 'public',
    emptyOutDir: true,
    sourcemap: true,
    rollupOptions: {
      input: resolve(__dirname, 'src/index.jsx'),
      output: {
        entryFileNames: `js/${name}.min.js`,
        chunkFileNames: `js/${name}.[name].js`,
        assetFileNames: (assetInfo) => {
          if (assetInfo.name?.endsWith('.css')) return `css/${name}.min.css`;
          return `assets/[name][extname]`;
        }
      }
    },
    minify: 'terser',
    terserOptions: {
      compress: {
        drop_console: command === 'build'
      }
    }
  }
}));
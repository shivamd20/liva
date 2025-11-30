import { defineConfig } from 'vite';
import react from '@vitejs/plugin-react';
import path from 'path';
import tailwindcss from '@tailwindcss/vite'


export default defineConfig({
  plugins: [react(), tailwindcss()],
  root: __dirname,

  resolve: {
    alias: {
      '@': path.resolve(__dirname, './src'),
      '@root': path.resolve(__dirname, '../src')
    }
  },

  server: {
    port: 5173,

    proxy: {
      '/api/': {
        target: 'http://127.0.0.1:8787', // wrangler dev default port
        changeOrigin: true,
        ws: true
      },
       '/ws/note': {
        target: 'http://127.0.0.1:8787', // wrangler dev default port
        changeOrigin: false,
        ws: true,
        rewriteWsOrigin: false
      }
    }
  },

  build: {
    outDir: '../public'
  }
});
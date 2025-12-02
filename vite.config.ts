import { defineConfig } from 'vite'
import react from '@vitejs/plugin-react'
import tailwindcss from '@tailwindcss/vite'

export default defineConfig({
  root: './ui',
  envDir: '.',
  plugins: [react(), tailwindcss()],
  server: {
    port: 5173,
    proxy: {
      '/api/': {
        target: 'http://127.0.0.1:8787',
        changeOrigin: true,
        ws: true,
      },
      '/ws/note': {
        target: 'http://127.0.0.1:8787',
        changeOrigin: false,
        ws: true,
        rewriteWsOrigin: false,
      },
    },
  },
  build: {
    outDir: '../public',
  },
})

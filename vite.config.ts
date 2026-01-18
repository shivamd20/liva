import { defineConfig } from 'vite'
import react from '@vitejs/plugin-react'
import tailwindcss from '@tailwindcss/vite'
import path from 'node:path'

export default defineConfig({
  envDir: '.',
  plugins: [react(), tailwindcss()],
  resolve: {
    alias: {
      '@': path.resolve(process.cwd(), 'src'),
      react: path.resolve(process.cwd(), 'node_modules/react'),
      'react-dom': path.resolve(process.cwd(), 'node_modules/react-dom'),
      "@shvm/excalidraw-live-sync": path.resolve(__dirname, "./libs/excalidraw-live-sync/src"),
      "@shvm/vocal": path.resolve(__dirname, "./libs/vocal/src"),
      "@shvm/recorder": path.resolve(__dirname, "./libs/recorder/src"),
    },
  },
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
    outDir: 'public',
    sourcemap: true,
  },
})

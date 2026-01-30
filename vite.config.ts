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
      "@shvm/monorail": path.resolve(__dirname, "./libs/monorail/src"),
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
    chunkSizeWarningLimit: 500, // Warn if chunks exceed 500KB
    rollupOptions: {
      output: {
        manualChunks: (id) => {
          // Core React ecosystem - loaded on initial page
          if (id.includes('node_modules/react/') || 
              id.includes('node_modules/react-dom/') ||
              id.includes('node_modules/react-router-dom/') ||
              id.includes('node_modules/react-router/')) {
            return 'vendor-react';
          }
          
          // Excalidraw - heavy, only loaded when needed (lazy loaded routes)
          if (id.includes('@excalidraw/excalidraw')) {
            return 'vendor-excalidraw';
          }
          
          // Mermaid - heavy, only loaded when needed
          if (id.includes('node_modules/mermaid') ||
              id.includes('@excalidraw/mermaid-to-excalidraw')) {
            return 'vendor-mermaid';
          }
          
          // TanStack data fetching
          if (id.includes('@tanstack/react-query') ||
              id.includes('@tanstack/query') ||
              id.includes('@trpc/client')) {
            return 'vendor-tanstack';
          }
          
          // TanStack AI - only loaded when needed
          if (id.includes('@tanstack/ai')) {
            return 'vendor-tanstack-ai';
          }
          
          // Radix UI components
          if (id.includes('@radix-ui/')) {
            return 'vendor-radix';
          }
          
          // Google/AWS SDKs - only loaded when needed
          if (id.includes('@google/genai') || id.includes('@aws-sdk/')) {
            return 'vendor-cloud';
          }
          
          // React Markdown and related
          if (id.includes('react-markdown') || 
              id.includes('remark-') ||
              id.includes('unified') ||
              id.includes('mdast') ||
              id.includes('micromark')) {
            return 'vendor-markdown';
          }
          
          // Other node_modules in a shared vendor chunk
          if (id.includes('node_modules')) {
            return 'vendor-common';
          }
        },
      },
    },
  },
})

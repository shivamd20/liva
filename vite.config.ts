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
        // Object-based manualChunks is much more memory efficient than function-based
        manualChunks: {
          // Core React ecosystem
          'vendor-react': ['react', 'react-dom', 'react-router-dom'],
          // Excalidraw - heavy, lazy loaded
          'vendor-excalidraw': ['@excalidraw/excalidraw'],
          // Mermaid - heavy, lazy loaded
          'vendor-mermaid': ['mermaid', '@excalidraw/mermaid-to-excalidraw'],
          // TanStack data fetching
          'vendor-tanstack': ['@tanstack/react-query', '@trpc/client'],
          // TanStack AI
          'vendor-tanstack-ai': ['@tanstack/ai', '@tanstack/ai-client', '@tanstack/ai-react', '@tanstack/ai-gemini', '@tanstack/ai-openai'],
          // Google/AWS SDKs
          'vendor-cloud': ['@google/genai', '@aws-sdk/client-s3', '@aws-sdk/s3-request-presigner'],
          // React Markdown
          'vendor-markdown': ['react-markdown', 'remark-gfm'],
        },
      },
    },
  },
})

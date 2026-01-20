// @ts-nocheck
import { defineConfig } from 'vite';
import react from '@vitejs/plugin-react';
import dts from 'vite-plugin-dts';
import path from 'path';

export default defineConfig({
    plugins: [
        react(),
        dts({
            include: ['src'],
            insertTypesEntry: true,
        }),
    ],
    server: {
        proxy: {
            '/api': {
                target: 'http://127.0.0.1:8787',
                changeOrigin: true,
            }
        }
    },
    build: {
        lib: {
            entry: path.resolve(__dirname, 'src/index.ts'),
            formats: ['es', 'cjs'],
            fileName: (format) => `index.${format === 'es' ? 'js' : 'cjs'}`,
        },
        rollupOptions: {
            external: ['react', 'react-dom', '@excalidraw/excalidraw'],
            output: {
                globals: {
                    react: 'React',
                    'react-dom': 'ReactDOM',
                    '@excalidraw/excalidraw': 'ExcalidrawLib',
                },
            },
        },
        sourcemap: true,
        emptyOutDir: true,
    },
});

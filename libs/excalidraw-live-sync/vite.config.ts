import { defineConfig } from 'vite';
import react from '@vitejs/plugin-react';
import { resolve } from 'path';
import dts from 'vite-plugin-dts';

export default defineConfig({
    plugins: [
        react(),
        dts({
            insertTypesEntry: true,
            include: ['src'],
        }),
    ],
    build: {
        sourcemap: true,
        lib: {
            entry: resolve(__dirname, 'src/index.ts'),
            name: 'ExcalidrawLiveSync',
            fileName: 'index',
            formats: ['es', 'cjs']
        },
        rollupOptions: {
            external: ['react', 'react-dom', '@excalidraw/excalidraw'],
            output: {
                globals: {
                    react: 'React',
                    'react-dom': 'ReactDOM',
                    '@excalidraw/excalidraw': 'ExcalidrawLib'
                }
            }
        }
    }
});

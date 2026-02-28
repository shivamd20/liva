import { defineConfig } from 'vitest/config';
import path from 'path';

export default defineConfig({
  test: {
    environment: 'node',
    passWithNoTests: true,
    include: [
      'tests/**/*.test.ts',
      'src/**/__tests__/**/*.test.ts',
      'server/**/__tests__/**/*.test.ts',
    ],
    testTimeout: 60000,
    hookTimeout: 30000,
    reporters: ['verbose'],
    globals: true,
  },
  resolve: {
    alias: {
      '@': path.resolve(__dirname, 'src'),
    },
  },
});

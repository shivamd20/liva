import { defineConfig } from 'vitest/config';

export default defineConfig({
  test: {
    // Run tests in Node environment (for integration tests)
    environment: 'node',
    
    // Test file patterns
    include: ['tests/**/*.test.ts'],
    
    // Timeout for async tests
    testTimeout: 60000,
    
    // Hook timeout
    hookTimeout: 30000,
    
    // Reporter
    reporters: ['verbose'],
    
    // Global test utilities
    globals: true,
  },
});

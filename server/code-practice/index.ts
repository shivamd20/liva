/**
 * Code Practice Module
 * 
 * Exports all code practice functionality.
 */

// Export all types from types.ts
export * from './types';

// Export router
export * from './router';

// Engine exports (new clean interface)
export {
  // Engine class and factory
  CodeExecutionEngine,
  createEngine,
  // Helper functions
  buildJavaCompileCommand,
  buildJavaRunCommand,
  getGsonJarPath,
} from './engine';

// Engine router
export { engineRouter } from './engine/router';

// Engine types are available via ./engine/types directly if needed

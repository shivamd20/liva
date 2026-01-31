/**
 * Code Execution Engine Router
 * 
 * Public endpoint for the code execution engine.
 * For development and testing only - no auth/rate limiting.
 */

import { z } from 'zod';
import { t, publicProcedure } from '../../trpc-config';
import { createEngine } from './index';
import {
  ExecutionRequest,
  SupportedLanguage,
  FileSpec,
  CompileSpec,
  RunSpec,
  ResourceLimits,
} from './types';

// =============================================================================
// Router
// =============================================================================

export const engineRouter = t.router({
  /**
   * Execute code in the sandbox.
   * 
   * This is a "dumb" execution endpoint that:
   * - Takes files, compile command, run command
   * - Returns raw stdout/stderr/exit codes
   * - Does NOT know about test cases, correctness, or scoring
   */
  execute: publicProcedure
    .input(ExecutionRequest)
    .mutation(async ({ input, ctx }) => {
      console.log(`[ENGINE] Execute request: ${input.executionId}, language=${input.language}`);
      console.log(`[ENGINE] Files: ${input.files.map(f => f.path).join(', ')}`);
      
      const engine = createEngine(ctx.env);
      const startTime = Date.now();
      
      try {
        const result = await engine.execute(input);
        
        const duration = Date.now() - startTime;
        console.log(`[ENGINE] Execution completed in ${duration}ms`);
        console.log(`[ENGINE] Compile: ${result.compile?.success ?? 'N/A'}, Run: ${result.run.success}`);
        
        return result;
      } catch (error) {
        console.error(`[ENGINE] Execution failed:`, error);
        throw error;
      }
    }),

  /**
   * Health check endpoint for the engine.
   */
  health: publicProcedure.query(() => {
    return {
      status: 'ok',
      engine: 'code-execution-engine',
      version: '1.0.0',
      timestamp: new Date().toISOString(),
    };
  }),

  /**
   * Get engine capabilities and configuration.
   */
  capabilities: publicProcedure.query(() => {
    return {
      supportedLanguages: ['java', 'cpp', 'python', 'go'] as const,
      gsonJarPath: '/opt/libs/gson-2.13.2.jar',
      workspaceBase: '/workspace/exec',
      defaults: {
        compileTimeoutMs: 10000,
        runTimeoutMs: 5000,
        memoryLimitMb: 256,
        cpuLimitMs: 5000,
      },
      notes: [
        'Java: Gson 2.13.2 is available on the classpath',
        'All paths in files[] are relative to the execution workspace',
        'stdin is passed via heredoc, so it preserves special characters',
        'stdout/stderr are returned raw without parsing',
      ],
    };
  }),
});

export type EngineRouter = typeof engineRouter;

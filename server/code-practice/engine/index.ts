/**
 * Code Execution Engine
 * 
 * Language-agnostic, judge-agnostic execution engine.
 * Does exactly one thing: compile + run + return raw results.
 * 
 * Design principles:
 * - Single sandbox instance (reused, no concurrency)
 * - No knowledge of test cases, correctness, or scoring
 * - Returns raw stdout/stderr without parsing
 * - Caller is responsible for interpreting results
 */

import type { Sandbox } from '@cloudflare/sandbox';
import type {
  ExecutionRequest,
  ExecutionResult,
  PhaseResult,
  EngineError,
} from './types';

// Re-export types for convenience
export * from './types';

// =============================================================================
// Engine Configuration
// =============================================================================

/** Gson JAR path in the container (per Dockerfile) */
const GSON_JAR = '/opt/libs/gson-2.13.2.jar';

/** Base workspace directory */
const WORKSPACE_BASE = '/workspace/exec';

// =============================================================================
// Code Execution Engine Class
// =============================================================================

export class CodeExecutionEngine {
  private sandbox: Sandbox | null = null;
  private sandboxStub: DurableObjectStub<Sandbox> | null = null;

  constructor(private env: Env) {}

  /**
   * Get or create the sandbox instance.
   * Reuses a single sandbox for all executions (no concurrency).
   */
  private async getSandbox(): Promise<Sandbox> {
    if (!this.sandboxStub) {
      // Use a fixed name for singleton sandbox
      const id = this.env.CODE_PRACTICE_SANDBOX.idFromName('default');
      this.sandboxStub = this.env.CODE_PRACTICE_SANDBOX.get(id);
    }
    // The stub acts as a proxy to the sandbox
    return this.sandboxStub as unknown as Sandbox;
  }

  /**
   * Execute code according to the request specification.
   * 
   * @param request - The execution request
   * @returns ExecutionResult with compile/run results
   */
  async execute(request: ExecutionRequest): Promise<ExecutionResult> {
    const startTime = Date.now();
    const sandbox = await this.getSandbox();
    
    // Execution workspace for this request
    const workDir = `${WORKSPACE_BASE}/${request.executionId}`;
    const actualCwd = request.cwd ? `${workDir}/${request.cwd}` : workDir;

    try {
      // 1. Setup workspace
      await this.setupWorkspace(sandbox, workDir, request);

      // 2. Compile phase (if specified)
      let compileResult: PhaseResult | undefined;
      if (request.compile) {
        compileResult = await this.runPhase(
          sandbox,
          request.compile.cmd,
          undefined, // no stdin for compile
          request.compile.timeoutMs,
          actualCwd,
          request.env
        );

        // If compilation failed, skip run phase
        if (!compileResult.success) {
          return {
            executionId: request.executionId,
            compile: compileResult,
            run: {
              success: false,
              exitCode: -1,
              stdout: '',
              stderr: 'Skipped due to compilation failure',
              timeMs: 0,
            },
          };
        }
      }

      // 3. Run phase
      const runResult = await this.runPhase(
        sandbox,
        request.run.cmd,
        request.run.stdin,
        request.run.timeoutMs,
        actualCwd,
        request.env
      );

      return {
        executionId: request.executionId,
        compile: compileResult,
        run: runResult,
      };

    } catch (error) {
      // Handle engine-level errors
      const engineError = this.categorizeError(error);
      
      return {
        executionId: request.executionId,
        compile: undefined,
        run: {
          success: false,
          exitCode: -1,
          stdout: '',
          stderr: engineError.message,
          timeMs: Date.now() - startTime,
        },
        error: engineError,
      };

    } finally {
      // Cleanup workspace (best effort)
      try {
        await this.cleanupWorkspace(sandbox, workDir);
      } catch (cleanupError) {
        console.warn(`[ENGINE] Cleanup failed for ${request.executionId}:`, cleanupError);
      }
    }
  }

  /**
   * Setup the workspace by creating directories and writing files.
   */
  private async setupWorkspace(
    sandbox: Sandbox,
    workDir: string,
    request: ExecutionRequest
  ): Promise<void> {
    // Create workspace directory
    await sandbox.mkdir(workDir, { recursive: true });

    // Write all files
    for (const file of request.files) {
      const filePath = `${workDir}/${file.path}`;
      
      // Ensure parent directory exists
      const parentDir = filePath.substring(0, filePath.lastIndexOf('/'));
      if (parentDir !== workDir) {
        await sandbox.mkdir(parentDir, { recursive: true });
      }

      // Write file content
      await sandbox.writeFile(filePath, file.content);

      // Make executable if specified
      if (file.executable) {
        await sandbox.exec(`chmod +x "${filePath}"`);
      }
    }
  }

  /**
   * Run a single phase (compile or run).
   */
  private async runPhase(
    sandbox: Sandbox,
    cmd: string,
    stdin: string | undefined,
    timeoutMs: number,
    cwd: string,
    env?: Record<string, string>
  ): Promise<PhaseResult> {
    const startTime = Date.now();

    try {
      let fullCmd: string;
      
      // If stdin is provided, write it to a file and redirect
      if (stdin !== undefined && stdin !== '') {
        const stdinFile = `${cwd}/__stdin__.txt`;
        await sandbox.writeFile(stdinFile, stdin);
        fullCmd = `cd "${cwd}" && ${cmd} < __stdin__.txt`;
      } else {
        fullCmd = `cd "${cwd}" && ${cmd}`;
      }

      // Execute the command
      const result = await sandbox.exec(fullCmd, {
        timeout: timeoutMs,
      });

      return {
        success: result.exitCode === 0,
        exitCode: result.exitCode,
        stdout: result.stdout || '',
        stderr: result.stderr || '',
        timeMs: Date.now() - startTime,
      };

    } catch (error: unknown) {
      const elapsed = Date.now() - startTime;
      
      // Check for timeout
      if (error instanceof Error && error.message.includes('timeout')) {
        return {
          success: false,
          exitCode: 124, // Standard timeout exit code
          stdout: '',
          stderr: `Execution timed out after ${timeoutMs}ms`,
          timeMs: elapsed,
        };
      }

      // Other execution errors
      return {
        success: false,
        exitCode: -1,
        stdout: '',
        stderr: error instanceof Error ? error.message : String(error),
        timeMs: elapsed,
      };
    }
  }

  /**
   * Cleanup the workspace after execution.
   */
  private async cleanupWorkspace(sandbox: Sandbox, workDir: string): Promise<void> {
    // Remove the execution directory recursively
    await sandbox.exec(`rm -rf "${workDir}"`);
  }

  /**
   * Categorize an error into an EngineError type.
   */
  private categorizeError(error: unknown): EngineError {
    if (error instanceof Error) {
      const message = error.message.toLowerCase();
      
      if (message.includes('timeout')) {
        return { type: 'timeout', message: error.message };
      }
      if (message.includes('memory') || message.includes('oom')) {
        return { type: 'oom', message: error.message };
      }
      
      return { type: 'sandbox_error', message: error.message };
    }
    
    return { type: 'sandbox_error', message: String(error) };
  }
}

// =============================================================================
// Factory Function
// =============================================================================

/**
 * Create a code execution engine instance.
 * 
 * @param env - Cloudflare Workers environment
 * @returns CodeExecutionEngine instance
 */
export function createEngine(env: Env): CodeExecutionEngine {
  return new CodeExecutionEngine(env);
}

// =============================================================================
// Helper: Build Java Commands
// =============================================================================

/**
 * Helper to build Java compile command with Gson on classpath.
 * 
 * @param mainFile - Main Java file to compile (e.g., "Main.java")
 * @param additionalFiles - Additional Java files to compile
 * @returns Compile command string
 */
export function buildJavaCompileCommand(
  mainFile: string,
  additionalFiles: string[] = []
): string {
  const files = [mainFile, ...additionalFiles].join(' ');
  return `javac -cp "${GSON_JAR}:." ${files}`;
}

/**
 * Helper to build Java run command with Gson on classpath.
 * 
 * @param mainClass - Main class to run (e.g., "Main")
 * @param jvmArgs - Optional JVM arguments (e.g., "-Xmx256m")
 * @returns Run command string
 */
export function buildJavaRunCommand(
  mainClass: string,
  jvmArgs: string = '-Xmx256m'
): string {
  return `java ${jvmArgs} -cp "${GSON_JAR}:." ${mainClass}`;
}

/**
 * Get the Gson JAR path.
 * Useful for callers who need to construct their own classpath.
 */
export function getGsonJarPath(): string {
  return GSON_JAR;
}

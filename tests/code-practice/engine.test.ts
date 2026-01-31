/**
 * Code Execution Engine Integration Tests
 * 
 * Tests the dumb execution engine against a real dev server.
 */

import { describe, it, expect, beforeAll } from 'vitest';

// =============================================================================
// Test Configuration
// =============================================================================

const API_PORT = process.env.API_PORT || '5173';
const API_BASE = `http://localhost:${API_PORT}/api/v1`;

// Helper to make tRPC calls
async function engineExecute(request: EngineExecuteRequest): Promise<EngineExecuteResult> {
  const response = await fetch(`${API_BASE}/engine.execute`, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify(request),
  });

  if (!response.ok) {
    const text = await response.text();
    throw new Error(`Engine execute failed: ${response.status} - ${text}`);
  }

  const json = await response.json() as { result: { data: EngineExecuteResult } };
  return json.result.data;
}

async function engineHealth(): Promise<{ status: string }> {
  const response = await fetch(`${API_BASE}/engine.health`, {
    method: 'GET',
    headers: { 'Content-Type': 'application/json' },
  });

  if (!response.ok) {
    throw new Error(`Health check failed: ${response.status}`);
  }

  const json = await response.json() as { result: { data: { status: string } } };
  return json.result.data;
}

// =============================================================================
// Types
// =============================================================================

interface FileSpec {
  path: string;
  content: string;
  executable?: boolean;
}

interface CompileSpec {
  cmd: string;
  timeoutMs: number;
}

interface RunSpec {
  cmd: string;
  stdin?: string;
  timeoutMs: number;
}

interface ResourceLimits {
  cpuMs: number;
  memoryMb: number;
}

interface EngineExecuteRequest {
  executionId: string;
  language: 'java' | 'cpp' | 'python' | 'go';
  files: FileSpec[];
  compile?: CompileSpec;
  run: RunSpec;
  limits: ResourceLimits;
  env?: Record<string, string>;
  cwd?: string;
}

interface PhaseResult {
  success: boolean;
  exitCode: number;
  stdout: string;
  stderr: string;
  timeMs: number;
}

interface EngineError {
  type: 'timeout' | 'oom' | 'sandbox_error';
  message: string;
}

interface EngineExecuteResult {
  executionId: string;
  compile?: PhaseResult;
  run: PhaseResult;
  error?: EngineError;
}

// =============================================================================
// Helpers
// =============================================================================

const GSON_JAR = '/opt/libs/gson-2.13.2.jar';

function generateExecutionId(): string {
  return `test_${Date.now()}_${Math.random().toString(36).substring(7)}`;
}

function buildJavaCompileCmd(files: string[]): string {
  return `javac -cp "${GSON_JAR}:." ${files.join(' ')}`;
}

function buildJavaRunCmd(mainClass: string, jvmArgs = '-Xmx256m'): string {
  return `java ${jvmArgs} -cp "${GSON_JAR}:." ${mainClass}`;
}

// =============================================================================
// Tests
// =============================================================================

describe('Code Execution Engine', () => {
  beforeAll(async () => {
    try {
      const health = await engineHealth();
      expect(health.status).toBe('ok');
      console.log('Engine health check passed');
    } catch (error) {
      console.error('Engine health check failed - is the dev server running?');
      throw error;
    }
  });

  describe('Basic Java Compilation & Execution', () => {
    it('should compile and run Hello World', async () => {
      const request: EngineExecuteRequest = {
        executionId: generateExecutionId(),
        language: 'java',
        files: [{
          path: 'Main.java',
          content: `public class Main {
    public static void main(String[] args) {
        System.out.println("Hello, World!");
    }
}`,
        }],
        compile: { cmd: buildJavaCompileCmd(['Main.java']), timeoutMs: 10000 },
        run: { cmd: buildJavaRunCmd('Main'), timeoutMs: 5000 },
        limits: { cpuMs: 5000, memoryMb: 256 },
      };

      const result = await engineExecute(request);

      expect(result.executionId).toBe(request.executionId);
      expect(result.compile?.success).toBe(true);
      expect(result.run.success).toBe(true);
      expect(result.run.stdout.trim()).toBe('Hello, World!');
    }, 30000);

    it('should handle stdin', async () => {
      const request: EngineExecuteRequest = {
        executionId: generateExecutionId(),
        language: 'java',
        files: [{
          path: 'Main.java',
          content: `import java.util.Scanner;
public class Main {
    public static void main(String[] args) {
        Scanner sc = new Scanner(System.in);
        String name = sc.nextLine();
        System.out.println("Hello, " + name + "!");
    }
}`,
        }],
        compile: { cmd: buildJavaCompileCmd(['Main.java']), timeoutMs: 10000 },
        run: { cmd: buildJavaRunCmd('Main'), stdin: 'Alice', timeoutMs: 5000 },
        limits: { cpuMs: 5000, memoryMb: 256 },
      };

      const result = await engineExecute(request);

      expect(result.compile?.success).toBe(true);
      expect(result.run.success).toBe(true);
      expect(result.run.stdout.trim()).toBe('Hello, Alice!');
    }, 30000);
  });

  describe('Compilation Errors', () => {
    it('should capture syntax errors', async () => {
      const request: EngineExecuteRequest = {
        executionId: generateExecutionId(),
        language: 'java',
        files: [{
          path: 'Main.java',
          content: `public class Main {
    public static void main(String[] args) {
        System.out.println("Missing semicolon")
    }
}`,
        }],
        compile: { cmd: buildJavaCompileCmd(['Main.java']), timeoutMs: 10000 },
        run: { cmd: buildJavaRunCmd('Main'), timeoutMs: 5000 },
        limits: { cpuMs: 5000, memoryMb: 256 },
      };

      const result = await engineExecute(request);

      expect(result.compile?.success).toBe(false);
      expect(result.compile?.stderr).toContain('error');
      expect(result.run.success).toBe(false);
    }, 30000);
  });

  describe('Runtime Errors', () => {
    it('should capture ArrayIndexOutOfBoundsException', async () => {
      const request: EngineExecuteRequest = {
        executionId: generateExecutionId(),
        language: 'java',
        files: [{
          path: 'Main.java',
          content: `public class Main {
    public static void main(String[] args) {
        int[] arr = new int[5];
        System.out.println(arr[10]);
    }
}`,
        }],
        compile: { cmd: buildJavaCompileCmd(['Main.java']), timeoutMs: 10000 },
        run: { cmd: buildJavaRunCmd('Main'), timeoutMs: 5000 },
        limits: { cpuMs: 5000, memoryMb: 256 },
      };

      const result = await engineExecute(request);

      expect(result.compile?.success).toBe(true);
      expect(result.run.success).toBe(false);
      expect(result.run.stderr).toContain('ArrayIndexOutOfBoundsException');
    }, 30000);
  });

  describe('Gson Integration', () => {
    it('should serialize JSON with Gson', async () => {
      const request: EngineExecuteRequest = {
        executionId: generateExecutionId(),
        language: 'java',
        files: [{
          path: 'Main.java',
          content: `import com.google.gson.Gson;
import java.util.Arrays;

public class Main {
    public static void main(String[] args) {
        Gson gson = new Gson();
        int[] nums = {1, 2, 3, 4, 5};
        System.out.println(gson.toJson(nums));
    }
}`,
        }],
        compile: { cmd: buildJavaCompileCmd(['Main.java']), timeoutMs: 10000 },
        run: { cmd: buildJavaRunCmd('Main'), timeoutMs: 5000 },
        limits: { cpuMs: 5000, memoryMb: 256 },
      };

      const result = await engineExecute(request);

      expect(result.compile?.success).toBe(true);
      expect(result.run.success).toBe(true);
      expect(result.run.stdout.trim()).toBe('[1,2,3,4,5]');
    }, 30000);

    it('should parse JSON with Gson', async () => {
      const request: EngineExecuteRequest = {
        executionId: generateExecutionId(),
        language: 'java',
        files: [{
          path: 'Main.java',
          content: `import com.google.gson.Gson;
import java.util.Scanner;

public class Main {
    public static void main(String[] args) {
        Scanner sc = new Scanner(System.in);
        String json = sc.nextLine();
        Gson gson = new Gson();
        int[] nums = gson.fromJson(json, int[].class);
        int sum = 0;
        for (int n : nums) sum += n;
        System.out.println(sum);
    }
}`,
        }],
        compile: { cmd: buildJavaCompileCmd(['Main.java']), timeoutMs: 10000 },
        run: { cmd: buildJavaRunCmd('Main'), stdin: '[1, 2, 3, 4, 5]', timeoutMs: 5000 },
        limits: { cpuMs: 5000, memoryMb: 256 },
      };

      const result = await engineExecute(request);

      expect(result.compile?.success).toBe(true);
      expect(result.run.success).toBe(true);
      expect(result.run.stdout.trim()).toBe('15');
    }, 30000);
  });

  describe('Multi-File Support', () => {
    it('should compile multiple files', async () => {
      const request: EngineExecuteRequest = {
        executionId: generateExecutionId(),
        language: 'java',
        files: [
          {
            path: 'Main.java',
            content: `public class Main {
    public static void main(String[] args) {
        System.out.println(Helper.greet("World"));
    }
}`,
          },
          {
            path: 'Helper.java',
            content: `public class Helper {
    public static String greet(String name) {
        return "Hello, " + name + "!";
    }
}`,
          },
        ],
        compile: { cmd: buildJavaCompileCmd(['Main.java', 'Helper.java']), timeoutMs: 10000 },
        run: { cmd: buildJavaRunCmd('Main'), timeoutMs: 5000 },
        limits: { cpuMs: 5000, memoryMb: 256 },
      };

      const result = await engineExecute(request);

      expect(result.compile?.success).toBe(true);
      expect(result.run.success).toBe(true);
      expect(result.run.stdout.trim()).toBe('Hello, World!');
    }, 30000);
  });

  describe('LeetCode Data Structures', () => {
    it('should handle linked list as array', async () => {
      const request: EngineExecuteRequest = {
        executionId: generateExecutionId(),
        language: 'java',
        files: [{
          path: 'Main.java',
          content: `import com.google.gson.Gson;
import java.util.*;

class ListNode {
    int val;
    ListNode next;
    ListNode(int x) { val = x; }
}

public class Main {
    public static void main(String[] args) {
        Scanner sc = new Scanner(System.in);
        Gson gson = new Gson();
        int[] arr = gson.fromJson(sc.nextLine(), int[].class);
        
        // Build linked list
        ListNode dummy = new ListNode(0);
        ListNode curr = dummy;
        for (int v : arr) {
            curr.next = new ListNode(v);
            curr = curr.next;
        }
        
        // Reverse it
        ListNode prev = null;
        curr = dummy.next;
        while (curr != null) {
            ListNode next = curr.next;
            curr.next = prev;
            prev = curr;
            curr = next;
        }
        
        // Serialize back
        List<Integer> result = new ArrayList<>();
        while (prev != null) {
            result.add(prev.val);
            prev = prev.next;
        }
        System.out.println(gson.toJson(result));
    }
}`,
        }],
        compile: { cmd: buildJavaCompileCmd(['Main.java']), timeoutMs: 10000 },
        run: { cmd: buildJavaRunCmd('Main'), stdin: '[1,2,3,4,5]', timeoutMs: 5000 },
        limits: { cpuMs: 5000, memoryMb: 256 },
      };

      const result = await engineExecute(request);

      expect(result.compile?.success).toBe(true);
      expect(result.run.success).toBe(true);
      expect(result.run.stdout.trim()).toBe('[5,4,3,2,1]');
    }, 30000);

    it('should handle 2D matrix', async () => {
      const request: EngineExecuteRequest = {
        executionId: generateExecutionId(),
        language: 'java',
        files: [{
          path: 'Main.java',
          content: `import com.google.gson.Gson;
import java.util.Scanner;

public class Main {
    public static void main(String[] args) {
        Scanner sc = new Scanner(System.in);
        Gson gson = new Gson();
        int[][] matrix = gson.fromJson(sc.nextLine(), int[][].class);
        
        int sum = 0;
        for (int[] row : matrix) {
            for (int val : row) {
                sum += val;
            }
        }
        System.out.println(sum);
    }
}`,
        }],
        compile: { cmd: buildJavaCompileCmd(['Main.java']), timeoutMs: 10000 },
        run: { cmd: buildJavaRunCmd('Main'), stdin: '[[1,2,3],[4,5,6],[7,8,9]]', timeoutMs: 5000 },
        limits: { cpuMs: 5000, memoryMb: 256 },
      };

      const result = await engineExecute(request);

      expect(result.compile?.success).toBe(true);
      expect(result.run.success).toBe(true);
      expect(result.run.stdout.trim()).toBe('45');
    }, 30000);

    it('should handle binary tree level-order', async () => {
      const request: EngineExecuteRequest = {
        executionId: generateExecutionId(),
        language: 'java',
        files: [{
          path: 'Main.java',
          content: `import com.google.gson.Gson;
import java.util.*;

class TreeNode {
    int val;
    TreeNode left, right;
    TreeNode(int x) { val = x; }
}

public class Main {
    public static void main(String[] args) {
        Scanner sc = new Scanner(System.in);
        Gson gson = new Gson();
        Integer[] arr = gson.fromJson(sc.nextLine(), Integer[].class);
        
        if (arr == null || arr.length == 0 || arr[0] == null) {
            System.out.println(0);
            return;
        }
        
        TreeNode root = new TreeNode(arr[0]);
        Queue<TreeNode> queue = new LinkedList<>();
        queue.offer(root);
        int i = 1;
        
        while (!queue.isEmpty() && i < arr.length) {
            TreeNode node = queue.poll();
            if (i < arr.length && arr[i] != null) {
                node.left = new TreeNode(arr[i]);
                queue.offer(node.left);
            }
            i++;
            if (i < arr.length && arr[i] != null) {
                node.right = new TreeNode(arr[i]);
                queue.offer(node.right);
            }
            i++;
        }
        
        System.out.println(maxDepth(root));
    }
    
    static int maxDepth(TreeNode root) {
        if (root == null) return 0;
        return 1 + Math.max(maxDepth(root.left), maxDepth(root.right));
    }
}`,
        }],
        compile: { cmd: buildJavaCompileCmd(['Main.java']), timeoutMs: 10000 },
        run: { cmd: buildJavaRunCmd('Main'), stdin: '[3,9,20,null,null,15,7]', timeoutMs: 5000 },
        limits: { cpuMs: 5000, memoryMb: 256 },
      };

      const result = await engineExecute(request);

      expect(result.compile?.success).toBe(true);
      expect(result.run.success).toBe(true);
      expect(result.run.stdout.trim()).toBe('3');
    }, 30000);
  });
});

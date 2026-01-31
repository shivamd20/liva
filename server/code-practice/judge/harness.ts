/**
 * Harness Builder
 * 
 * Assembles files for execution:
 * - Main.java (from problem definition)
 * - Common.java (generated helper classes)
 * - UserSolution.java (user's code)
 */

import type { Problem, TypeSpec } from '../types';
import type { HarnessFiles, JudgeStdin, JudgeTestCase } from './types';
import { buildJavaCompileCommand, buildJavaRunCommand } from '../engine';

// =============================================================================
// Constants
// =============================================================================

const GSON_JAR = '/opt/libs/gson-2.13.2.jar';

// =============================================================================
// Main Entry Point
// =============================================================================

/**
 * Build all files needed for Java execution.
 */
export function buildJavaHarness(
  problem: Problem,
  userCode: string
): HarnessFiles {
  // Get Main.java from problem (required)
  const mainJava = problem.javaHarness;
  if (!mainJava) {
    throw new Error(`Problem ${problem.problemId} is missing javaHarness (Main.java)`);
  }

  // Generate Common.java with helper classes
  const commonJava = generateCommonJava(problem);

  // Wrap user code as UserSolution.java
  const userSolutionJava = wrapUserSolution(userCode, problem);

  // Determine which files to compile
  const filesToCompile = ['Main.java', 'Common.java', 'UserSolution.java'];

  return {
    files: [
      { path: 'Main.java', content: mainJava },
      { path: 'Common.java', content: commonJava },
      { path: 'UserSolution.java', content: userSolutionJava },
    ],
    compileCmd: `javac -cp "${GSON_JAR}:." ${filesToCompile.join(' ')}`,
    runCmd: `java -Xmx256m -cp "${GSON_JAR}:." Main`,
  };
}

/**
 * Build stdin JSON from test cases.
 */
export function buildStdin(problem: Problem, testFilter: 'all' | 'visible'): string {
  const allTests = problem.tests || [];
  const tests = testFilter === 'all'
    ? allTests
    : allTests.filter(t => t.visibility === 'visible');

  const stdin: JudgeStdin = {
    testcases: tests.map((test, index) => ({
      id: index,
      input: test.input,
    })),
  };

  return JSON.stringify(stdin);
}

// =============================================================================
// Common.java Generation
// =============================================================================

/**
 * Generate Common.java with helper classes based on problem's type specs.
 */
function generateCommonJava(problem: Problem): string {
  const helpers: string[] = [];

  // Check if we need TreeNode
  if (needsType(problem, 'tree')) {
    helpers.push(TREE_NODE_CLASS);
  }

  // Check if we need ListNode
  if (needsType(problem, 'linkedList')) {
    helpers.push(LIST_NODE_CLASS);
  }

  // Check if we need Node (for graphs)
  if (needsType(problem, 'graph')) {
    helpers.push(GRAPH_NODE_CLASS);
  }

  // Always include utility methods
  helpers.push(UTILITY_METHODS);

  return `/**
 * Common.java - Auto-generated helper classes
 * Problem: ${problem.problemId}
 */

import com.google.gson.*;
import com.google.gson.reflect.TypeToken;
import java.util.*;
import java.lang.reflect.Type;

${helpers.join('\n\n')}
`;
}

/**
 * Check if a problem needs a specific type.
 */
function needsType(problem: Problem, kind: string): boolean {
  return checkTypeSpec(problem.inputSpec, kind) ||
    checkTypeSpec(problem.outputSpec, kind);
}

/**
 * Recursively check if a TypeSpec contains a specific kind.
 */
function checkTypeSpec(spec: TypeSpec, kind: string): boolean {
  if (spec.kind === kind) return true;

  if (spec.kind === 'array' || spec.kind === 'matrix') {
    return checkTypeSpec(spec.of, kind);
  }

  if (spec.kind === 'tuple') {
    return spec.elements.some(e => checkTypeSpec(e, kind));
  }

  if (spec.kind === 'object') {
    return Object.values(spec.fields).some(f => checkTypeSpec(f, kind));
  }

  return false;
}

// =============================================================================
// User Solution Wrapping
// =============================================================================

/**
 * Wrap user code as UserSolution.java.
 * The user code should define a class with the solution method.
 */
function wrapUserSolution(userCode: string, problem: Problem): string {
  // Check if user already has a class definition
  const hasClassDef = /\bclass\s+\w+/.test(userCode);

  if (hasClassDef) {
    // User provided a complete class - rename it to UserSolution
    // This is a simple regex replacement, may not handle all edge cases
    const renamed = userCode.replace(
      /\bclass\s+(\w+)/,
      'class UserSolution'
    );
    return renamed;
  }

  // Wrap bare method in UserSolution class
  return `/**
 * UserSolution.java - User's solution
 */
public class UserSolution {
${userCode}
}`;
}

// =============================================================================
// Helper Class Templates
// =============================================================================

const TREE_NODE_CLASS = `
/**
 * TreeNode - Binary tree node for tree problems
 */
class TreeNode {
    int val;
    TreeNode left;
    TreeNode right;
    
    TreeNode() {}
    TreeNode(int val) { this.val = val; }
    TreeNode(int val, TreeNode left, TreeNode right) {
        this.val = val;
        this.left = left;
        this.right = right;
    }
    
    /**
     * Build tree from level-order array (LeetCode format).
     * null values represent missing nodes.
     */
    static TreeNode fromArray(Integer[] arr) {
        if (arr == null || arr.length == 0 || arr[0] == null) {
            return null;
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
        
        return root;
    }
    
    /**
     * Convert tree to level-order array.
     */
    static List<Integer> toArray(TreeNode root) {
        List<Integer> result = new ArrayList<>();
        if (root == null) return result;
        
        Queue<TreeNode> queue = new LinkedList<>();
        queue.offer(root);
        
        while (!queue.isEmpty()) {
            TreeNode node = queue.poll();
            if (node == null) {
                result.add(null);
            } else {
                result.add(node.val);
                queue.offer(node.left);
                queue.offer(node.right);
            }
        }
        
        // Remove trailing nulls
        while (!result.isEmpty() && result.get(result.size() - 1) == null) {
            result.remove(result.size() - 1);
        }
        
        return result;
    }
}`;

const LIST_NODE_CLASS = `
/**
 * ListNode - Singly linked list node
 */
class ListNode {
    int val;
    ListNode next;
    
    ListNode() {}
    ListNode(int val) { this.val = val; }
    ListNode(int val, ListNode next) { this.val = val; this.next = next; }
    
    /**
     * Build linked list from array.
     */
    static ListNode fromArray(int[] arr) {
        if (arr == null || arr.length == 0) return null;
        
        ListNode dummy = new ListNode(0);
        ListNode curr = dummy;
        for (int val : arr) {
            curr.next = new ListNode(val);
            curr = curr.next;
        }
        return dummy.next;
    }
    
    /**
     * Convert linked list to array.
     */
    static List<Integer> toArray(ListNode head) {
        List<Integer> result = new ArrayList<>();
        while (head != null) {
            result.add(head.val);
            head = head.next;
        }
        return result;
    }
}`;

const GRAPH_NODE_CLASS = `
/**
 * Node - Graph node with neighbors
 */
class Node {
    public int val;
    public List<Node> neighbors;
    
    public Node() {
        val = 0;
        neighbors = new ArrayList<Node>();
    }
    
    public Node(int _val) {
        val = _val;
        neighbors = new ArrayList<Node>();
    }
    
    public Node(int _val, ArrayList<Node> _neighbors) {
        val = _val;
        neighbors = _neighbors;
    }
}`;

const UTILITY_METHODS = `
/**
 * Utility class for common operations
 */
class JudgeUtils {
    private static final Gson gson = new GsonBuilder()
        .serializeNulls()
        .create();
    
    public static Gson getGson() {
        return gson;
    }
    
    /**
     * Parse JSON array to int array
     */
    public static int[] toIntArray(JsonArray arr) {
        int[] result = new int[arr.size()];
        for (int i = 0; i < arr.size(); i++) {
            result[i] = arr.get(i).getAsInt();
        }
        return result;
    }
    
    /**
     * Parse JSON array to Integer array (with nulls)
     */
    public static Integer[] toIntegerArray(JsonArray arr) {
        Integer[] result = new Integer[arr.size()];
        for (int i = 0; i < arr.size(); i++) {
            JsonElement el = arr.get(i);
            result[i] = el.isJsonNull() ? null : el.getAsInt();
        }
        return result;
    }
    
    /**
     * Parse JSON array to String array
     */
    public static String[] toStringArray(JsonArray arr) {
        String[] result = new String[arr.size()];
        for (int i = 0; i < arr.size(); i++) {
            result[i] = arr.get(i).getAsString();
        }
        return result;
    }
}`;

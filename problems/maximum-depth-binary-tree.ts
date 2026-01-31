import type { Problem } from './types';

/**
 * Maximum Depth of Binary Tree - LeetCode Problem #104
 * Difficulty: Easy
 * Topics: Tree, DFS, BFS, Binary Tree
 */
export const maximumDepthBinaryTree: Problem = {
  problemId: 'maximum-depth-binary-tree',
  title: 'Maximum Depth of Binary Tree',
  difficulty: 'easy',
  topics: ['tree', 'dfs', 'bfs', 'binary-tree'],
  
  description: `Given the \`root\` of a binary tree, return *its maximum depth*.

A binary tree's **maximum depth** is the number of nodes along the longest path from the root node down to the farthest leaf node.

**Example 1:**
\`\`\`
Input: root = [3,9,20,null,null,15,7]
Output: 3
\`\`\`

**Example 2:**
\`\`\`
Input: root = [1,null,2]
Output: 2
\`\`\``,

  constraints: [
    'The number of nodes in the tree is in the range [0, 10^4].',
    '-100 <= Node.val <= 100',
  ],

  inputSpec: {
    kind: 'tuple',
    elements: [{ kind: 'tree' }],
  },

  outputSpec: {
    kind: 'int',
  },

  functionSignature: {
    name: 'maxDepth',
    params: [
      { name: 'root', type: 'TreeNode', typeSpec: { kind: 'tree' } },
    ],
    returnType: 'int',
    returnTypeSpec: { kind: 'int' },
  },

  examples: [
    {
      input: [[3, 9, 20, null, null, 15, 7]],
      output: 3,
    },
    {
      input: [[1, null, 2]],
      output: 2,
    },
  ],

  tests: [
    // Visible tests
    {
      testId: 'visible-1',
      input: [[3, 9, 20, null, null, 15, 7]],
      expected: 3,
      comparator: { type: 'exact' },
      visibility: 'visible',
      weight: 1,
      description: 'Example 1 - balanced tree',
    },
    {
      testId: 'visible-2',
      input: [[1, null, 2]],
      expected: 2,
      comparator: { type: 'exact' },
      visibility: 'visible',
      weight: 1,
      description: 'Right-skewed tree',
    },
    {
      testId: 'visible-3',
      input: [[]],
      expected: 0,
      comparator: { type: 'exact' },
      visibility: 'visible',
      weight: 1,
      description: 'Empty tree',
    },
    // Hidden tests
    {
      testId: 'hidden-1',
      input: [[1]],
      expected: 1,
      comparator: { type: 'exact' },
      visibility: 'hidden',
      weight: 1,
      description: 'Single node',
    },
    {
      testId: 'hidden-2',
      input: [[1, 2, 3, 4, 5, 6, 7]],
      expected: 3,
      comparator: { type: 'exact' },
      visibility: 'hidden',
      weight: 1,
      description: 'Perfect binary tree',
    },
    {
      testId: 'hidden-3',
      input: [[1, 2, null, 3, null, 4, null, 5]],
      expected: 5,
      comparator: { type: 'exact' },
      visibility: 'hidden',
      weight: 2,
      description: 'Left-skewed tree',
    },
    {
      testId: 'hidden-4',
      input: [[1, 2, 3, 4, null, null, 5, 6, null, null, 7]],
      expected: 4,
      comparator: { type: 'exact' },
      visibility: 'hidden',
      weight: 2,
      description: 'Unbalanced tree',
    },
  ],

  referenceSolutions: {
    java: `class Solution {
    public int maxDepth(TreeNode root) {
        if (root == null) {
            return 0;
        }
        int leftDepth = maxDepth(root.left);
        int rightDepth = maxDepth(root.right);
        return Math.max(leftDepth, rightDepth) + 1;
    }
}`,
    javascript: `function maxDepth(root) {
    if (root === null) {
        return 0;
    }
    return Math.max(maxDepth(root.left), maxDepth(root.right)) + 1;
}`,
  },

  timeLimit: 2000,
  memoryLimit: 256,

  javaHarness: `import com.google.gson.*;
import java.util.*;

public class Main {
    public static void main(String[] args) {
        Scanner sc = new Scanner(System.in);
        StringBuilder sb = new StringBuilder();
        while (sc.hasNextLine()) {
            sb.append(sc.nextLine());
        }
        
        Gson gson = new Gson();
        JsonObject input = JsonParser.parseString(sb.toString()).getAsJsonObject();
        JsonArray testcases = input.getAsJsonArray("testcases");
        
        List<Map<String, Object>> results = new ArrayList<>();
        UserSolution solution = new UserSolution();
        
        for (JsonElement tc : testcases) {
            JsonObject testcase = tc.getAsJsonObject();
            int id = testcase.get("id").getAsInt();
            JsonArray inputArr = testcase.getAsJsonArray("input");
            
            Map<String, Object> result = new LinkedHashMap<>();
            result.put("case", id);
            
            try {
                // Parse input: TreeNode root (as Integer array with nulls)
                Integer[] arr = gson.fromJson(inputArr.get(0), Integer[].class);
                TreeNode root = TreeNode.fromArray(arr);
                
                // Call user's solution
                int output = solution.maxDepth(root);
                
                result.put("status", "OK");
                result.put("output", output);
            } catch (Exception e) {
                result.put("status", "ERROR");
                result.put("error", e.getClass().getSimpleName() + ": " + e.getMessage());
            }
            
            results.add(result);
        }
        
        Map<String, Object> response = new LinkedHashMap<>();
        response.put("results", results);
        response.put("meta", Map.of("timeMs", System.currentTimeMillis()));
        
        System.out.println("<<<JUDGE_OUTPUT_V1_BEGIN>>>");
        System.out.println(gson.toJson(response));
        System.out.println("<<<JUDGE_OUTPUT_V1_END>>>");
    }
}`,
};

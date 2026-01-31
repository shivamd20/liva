# Problem Bank

This directory contains 100 curated DSA problems for FAANG interview preparation.

## Directory Structure

```
problems/
├── README.md              # This file
├── index.ts               # Problem registry (auto-imports all problems)
├── types.ts               # Type exports
│
├── 001-two-sum/
│   ├── problem.ts         # Problem definition
│   └── java/
│       └── index.ts       # Starter code, reference solution (as TS exports)
│
├── 002-valid-anagram/
│   ├── problem.ts
│   └── java/
│       └── index.ts
│
└── ... (more problems)

tests/
└── code-practice/
    └── problems/
        ├── 001-two-sum/
        │   └── problem.test.ts  # E2E tests against judge
        ├── 002-valid-anagram/
        │   └── problem.test.ts
        └── ...
```

## Creating a New Problem

### Step 1: Create Directory Structure

```bash
mkdir -p problems/NNN-problem-name/java
mkdir -p tests/code-practice/problems/NNN-problem-name
```

### Step 2: Create Problem Definition

Create `problem.ts` using this template:

```typescript
import type { Problem } from '../types';

export const problemName: Problem = {
  problemId: 'problem-name',  // URL-friendly slug
  title: 'Problem Title',
  difficulty: 'easy' | 'medium' | 'hard',
  topics: ['array', 'hash-table'],  // Use kebab-case
  
  description: `Your problem description in **Markdown**.

**Example 1:**
\`\`\`
Input: nums = [1,2,3]
Output: 6
\`\`\``,
  
  constraints: [
    '1 <= nums.length <= 10^4',
    '-10^9 <= nums[i] <= 10^9',
  ],

  // Input specification - describes the shape of inputs
  inputSpec: {
    kind: 'tuple',
    elements: [
      { kind: 'array', of: { kind: 'int' } },  // First param: int[]
      { kind: 'int' },                          // Second param: int
    ],
  },

  // Output specification
  outputSpec: { kind: 'int' },

  // Function signature for code generation
  functionSignature: {
    name: 'methodName',
    params: [
      { name: 'nums', type: 'int[]', typeSpec: { kind: 'array', of: { kind: 'int' } } },
      { name: 'target', type: 'int', typeSpec: { kind: 'int' } },
    ],
    returnType: 'int',
    returnTypeSpec: { kind: 'int' },
  },

  // Examples shown to user
  examples: [
    {
      input: [[1, 2, 3], 6],
      output: 6,
      explanation: 'Optional explanation',
    },
  ],

  // Test cases (visible + hidden)
  tests: [
    // Visible: 3-5 from examples
    {
      testId: 'visible-1',
      input: [[1, 2, 3], 6],
      expected: 6,
      comparator: { type: 'exact' },
      visibility: 'visible',
      weight: 1,
      description: 'Basic case',
    },
    // Hidden: 5-10 edge cases
    {
      testId: 'hidden-1',
      input: [[0], 0],
      expected: 0,
      comparator: { type: 'exact' },
      visibility: 'hidden',
      weight: 2,
      description: 'Single element',
    },
  ],

  // Reference solution (for testing only - not exposed to users)
  referenceSolutions: {
    java: `class Solution {
    public int methodName(int[] nums, int target) {
        // implementation
    }
}`,
  },

  timeLimit: 2000,   // ms
  memoryLimit: 256,  // MB

  // Java harness - the judge entry point
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
                // Parse inputs - CUSTOMIZE THIS FOR EACH PROBLEM
                int[] nums = gson.fromJson(inputArr.get(0), int[].class);
                int target = inputArr.get(1).getAsInt();
                
                // Call user's solution - CUSTOMIZE METHOD NAME
                int output = solution.methodName(nums, target);
                
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
```

### Step 3: Create Java Language Files

Create `java/index.ts` with starter code and reference solution:

```typescript
/**
 * Problem Name - Java Language Files
 */

/**
 * Starter code - What users see when they start the problem.
 * Should be runnable but return wrong answer.
 */
export const starterCode = `import java.util.*;

class UserSolution {
    public int methodName(int[] nums, int target) {
        // TODO: Implement your solution here
        
        return 0; // Placeholder - returns wrong answer
    }
}`;

/**
 * Reference solution - Optimal solution for testing.
 */
export const referenceSolution = `import java.util.*;

class UserSolution {
    public int methodName(int[] nums, int target) {
        // Your optimal implementation here
    }
}`;
```

Then update `problem.ts` to import and use the starter code:

```typescript
import { starterCode as javaStarterCode, referenceSolution as javaReferenceSolution } from './java';

export const problemName: Problem = {
  // ... other fields ...
  
  starterCode: {
    java: javaStarterCode,
  },

  referenceSolutions: {
    java: javaReferenceSolution,
  },
  
  // ... rest of problem definition ...
};
```

### Step 4: Create Tests

Create `tests/problem.test.ts`:

```typescript
import { describe, it, expect, beforeAll } from 'vitest';

const API_PORT = process.env.API_PORT || '5173';
const API_BASE = `http://localhost:${API_PORT}/api/v1`;

async function runCode(input: { problemId: string; code: string; language: 'java' }) {
  const response = await fetch(`${API_BASE}/codePractice.runCode`, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify(input),
  });
  const json = await response.json();
  return json.result.data;
}

describe('Problem: Problem Name', () => {
  const PROBLEM_ID = 'problem-name';

  const CORRECT_SOLUTION = `class UserSolution {
    public int methodName(int[] nums, int target) {
        // correct implementation
    }
}`;

  const WRONG_ANSWER = `class UserSolution {
    public int methodName(int[] nums, int target) {
        return -1; // always wrong
    }
}`;

  const COMPILE_ERROR = `class UserSolution {
    public int methodName(int[] nums, int target) {
        return 0  // missing semicolon
    }
}`;

  const RUNTIME_ERROR = `class UserSolution {
    public int methodName(int[] nums, int target) {
        return nums[10000]; // ArrayIndexOutOfBounds
    }
}`;

  it('should return AC for correct solution', async () => {
    const result = await runCode({
      problemId: PROBLEM_ID,
      code: CORRECT_SOLUTION,
      language: 'java',
    });
    expect(result.verdict).toBe('AC');
    expect(result.score).toBe(1.0);
  }, 60000);

  it('should return WA for wrong answer', async () => {
    const result = await runCode({
      problemId: PROBLEM_ID,
      code: WRONG_ANSWER,
      language: 'java',
    });
    expect(result.verdict).toBe('WA');
  }, 60000);

  it('should return CE for compile error', async () => {
    const result = await runCode({
      problemId: PROBLEM_ID,
      code: COMPILE_ERROR,
      language: 'java',
    });
    expect(result.verdict).toBe('CE');
  }, 60000);

  it('should return RE for runtime error', async () => {
    const result = await runCode({
      problemId: PROBLEM_ID,
      code: RUNTIME_ERROR,
      language: 'java',
    });
    expect(result.verdict).toBe('RE');
  }, 60000);
});
```

### Step 5: Register Problem

Add to `problems/index.ts`:

```typescript
import { problemName } from './NNN-problem-name/problem';

export const problems: Record<string, Problem> = {
  'problem-name': problemName,
  // ... other problems
};
```

### Step 6: Test

```bash
# Run tests for your problem
API_PORT=5173 npx vitest run problems/NNN-problem-name/tests/problem.test.ts
```

---

## Comparator Types

| Type | Description | Use Case |
|------|-------------|----------|
| `exact` | Values must match exactly | Most problems |
| `unorderedArray` | Arrays match regardless of order | Two Sum (return indices in any order) |
| `set` | Arrays as sets (unique elements, any order) | Unique paths |
| `multiset` | Arrays as multisets (duplicates allowed, any order) | Anagrams |
| `numeric` | Float comparison with tolerance | Geometry problems |
| `floatArray` | Array of floats with tolerance | Multiple float outputs |

---

## TypeSpec Reference

| Kind | Java Type | Example |
|------|-----------|---------|
| `int` | `int` | `{ kind: 'int' }` |
| `long` | `long` | `{ kind: 'long' }` |
| `float` | `float` | `{ kind: 'float' }` |
| `double` | `double` | `{ kind: 'double' }` |
| `boolean` | `boolean` | `{ kind: 'boolean' }` |
| `string` | `String` | `{ kind: 'string' }` |
| `char` | `char` | `{ kind: 'char' }` |
| `array` | `T[]` | `{ kind: 'array', of: { kind: 'int' } }` |
| `matrix` | `T[][]` | `{ kind: 'matrix', of: { kind: 'int' } }` |
| `tuple` | Multiple args | `{ kind: 'tuple', elements: [...] }` |
| `tree` | `TreeNode` | `{ kind: 'tree' }` (auto-generates helper) |
| `linkedList` | `ListNode` | `{ kind: 'linkedList' }` (auto-generates helper) |
| `void` | `void` | `{ kind: 'void' }` |

---

## Test Case Guidelines

### Visible Tests (3-5)
- Examples from problem description
- Basic correctness checks
- Users can see input/output for debugging

### Hidden Tests (5-10)
- Edge cases: empty, single element, max size
- Boundary values: 0, -1, MAX_INT, MIN_INT
- Special cases: all same values, sorted, reverse sorted
- Large inputs: for TLE detection

---

## Common Harness Patterns

### Array Input/Output
```java
int[] nums = gson.fromJson(inputArr.get(0), int[].class);
int[] output = solution.method(nums);
result.put("output", output);
```

### LinkedList Input/Output
```java
int[] arr = gson.fromJson(inputArr.get(0), int[].class);
ListNode head = ListNode.fromArray(arr);
ListNode output = solution.method(head);
result.put("output", ListNode.toArray(output));
```

### Tree Input/Output
```java
Integer[] arr = gson.fromJson(inputArr.get(0), Integer[].class);
TreeNode root = TreeNode.fromArray(arr);
TreeNode output = solution.method(root);
result.put("output", TreeNode.toArray(output));
```

### Multiple Return Values
```java
// Return as array
result.put("output", new int[] { val1, val2 });

// Or as list
result.put("output", List.of(val1, val2));
```

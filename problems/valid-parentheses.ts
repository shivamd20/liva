import type { Problem } from './types';

/**
 * Valid Parentheses - LeetCode Problem #20
 * Difficulty: Easy
 * Topics: String, Stack
 */
export const validParentheses: Problem = {
  problemId: 'valid-parentheses',
  title: 'Valid Parentheses',
  difficulty: 'easy',
  topics: ['string', 'stack'],
  
  description: `Given a string \`s\` containing just the characters \`'('\`, \`')'\`, \`'{'\`, \`'}'\`, \`'['\` and \`']'\`, determine if the input string is valid.

An input string is valid if:
1. Open brackets must be closed by the same type of brackets.
2. Open brackets must be closed in the correct order.
3. Every close bracket has a corresponding open bracket of the same type.

**Example 1:**
\`\`\`
Input: s = "()"
Output: true
\`\`\`

**Example 2:**
\`\`\`
Input: s = "()[]{}"
Output: true
\`\`\`

**Example 3:**
\`\`\`
Input: s = "(]"
Output: false
\`\`\``,

  constraints: [
    '1 <= s.length <= 10^4',
    "s consists of parentheses only '()[]{}'.",
  ],

  inputSpec: {
    kind: 'tuple',
    elements: [{ kind: 'string' }],
  },

  outputSpec: {
    kind: 'boolean',
  },

  functionSignature: {
    name: 'isValid',
    params: [
      { name: 's', type: 'String', typeSpec: { kind: 'string' } },
    ],
    returnType: 'boolean',
    returnTypeSpec: { kind: 'boolean' },
  },

  examples: [
    { input: ['()'], output: true },
    { input: ['()[]{}'], output: true },
    { input: ['(]'], output: false },
  ],

  tests: [
    // Visible tests
    {
      testId: 'visible-1',
      input: ['()'],
      expected: true,
      comparator: { type: 'exact' },
      visibility: 'visible',
      weight: 1,
      description: 'Simple parentheses',
    },
    {
      testId: 'visible-2',
      input: ['()[]{}'],
      expected: true,
      comparator: { type: 'exact' },
      visibility: 'visible',
      weight: 1,
      description: 'All types valid',
    },
    {
      testId: 'visible-3',
      input: ['(]'],
      expected: false,
      comparator: { type: 'exact' },
      visibility: 'visible',
      weight: 1,
      description: 'Mismatched brackets',
    },
    // Hidden tests
    {
      testId: 'hidden-1',
      input: ['{[]}'],
      expected: true,
      comparator: { type: 'exact' },
      visibility: 'hidden',
      weight: 1,
      description: 'Nested brackets',
    },
    {
      testId: 'hidden-2',
      input: ['([)]'],
      expected: false,
      comparator: { type: 'exact' },
      visibility: 'hidden',
      weight: 2,
      description: 'Interleaved brackets - invalid',
    },
    {
      testId: 'hidden-3',
      input: [']'],
      expected: false,
      comparator: { type: 'exact' },
      visibility: 'hidden',
      weight: 1,
      description: 'Single closing bracket',
    },
    {
      testId: 'hidden-4',
      input: ['(((())))'],
      expected: true,
      comparator: { type: 'exact' },
      visibility: 'hidden',
      weight: 1,
      description: 'Deeply nested',
    },
    {
      testId: 'hidden-5',
      input: ['('],
      expected: false,
      comparator: { type: 'exact' },
      visibility: 'hidden',
      weight: 1,
      description: 'Unclosed bracket',
    },
    {
      testId: 'hidden-6',
      input: ['{[()]}'],
      expected: true,
      comparator: { type: 'exact' },
      visibility: 'hidden',
      weight: 2,
      description: 'Complex nested valid',
    },
  ],

  referenceSolutions: {
    java: `class Solution {
    public boolean isValid(String s) {
        java.util.Deque<Character> stack = new java.util.ArrayDeque<>();
        for (char c : s.toCharArray()) {
            if (c == '(' || c == '[' || c == '{') {
                stack.push(c);
            } else {
                if (stack.isEmpty()) return false;
                char top = stack.pop();
                if (c == ')' && top != '(') return false;
                if (c == ']' && top != '[') return false;
                if (c == '}' && top != '{') return false;
            }
        }
        return stack.isEmpty();
    }
}`,
    javascript: `function isValid(s) {
    const stack = [];
    const map = { ')': '(', ']': '[', '}': '{' };
    for (const c of s) {
        if (c === '(' || c === '[' || c === '{') {
            stack.push(c);
        } else {
            if (stack.length === 0 || stack.pop() !== map[c]) {
                return false;
            }
        }
    }
    return stack.length === 0;
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
                // Parse input: String s
                String s = inputArr.get(0).getAsString();
                
                // Call user's solution
                boolean output = solution.isValid(s);
                
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

import type { Problem } from './types';

/**
 * Reverse Linked List - LeetCode Problem #206
 * Difficulty: Easy
 * Topics: Linked List, Recursion
 */
export const reverseLinkedList: Problem = {
  problemId: 'reverse-linked-list',
  title: 'Reverse Linked List',
  difficulty: 'easy',
  topics: ['linked-list', 'recursion'],
  
  description: `Given the \`head\` of a singly linked list, reverse the list, and return *the reversed list*.

**Example 1:**
\`\`\`
Input: head = [1,2,3,4,5]
Output: [5,4,3,2,1]
\`\`\`

**Example 2:**
\`\`\`
Input: head = [1,2]
Output: [2,1]
\`\`\`

**Example 3:**
\`\`\`
Input: head = []
Output: []
\`\`\``,

  constraints: [
    'The number of nodes in the list is the range [0, 5000].',
    '-5000 <= Node.val <= 5000',
  ],

  inputSpec: {
    kind: 'tuple',
    elements: [{ kind: 'linkedList' }],
  },

  outputSpec: {
    kind: 'linkedList',
  },

  functionSignature: {
    name: 'reverseList',
    params: [
      { name: 'head', type: 'ListNode', typeSpec: { kind: 'linkedList' } },
    ],
    returnType: 'ListNode',
    returnTypeSpec: { kind: 'linkedList' },
  },

  examples: [
    { input: [[1, 2, 3, 4, 5]], output: [5, 4, 3, 2, 1] },
    { input: [[1, 2]], output: [2, 1] },
    { input: [[]], output: [] },
  ],

  tests: [
    // Visible tests
    {
      testId: 'visible-1',
      input: [[1, 2, 3, 4, 5]],
      expected: [5, 4, 3, 2, 1],
      comparator: { type: 'exact' },
      visibility: 'visible',
      weight: 1,
      description: 'Five elements',
    },
    {
      testId: 'visible-2',
      input: [[1, 2]],
      expected: [2, 1],
      comparator: { type: 'exact' },
      visibility: 'visible',
      weight: 1,
      description: 'Two elements',
    },
    {
      testId: 'visible-3',
      input: [[]],
      expected: [],
      comparator: { type: 'exact' },
      visibility: 'visible',
      weight: 1,
      description: 'Empty list',
    },
    // Hidden tests
    {
      testId: 'hidden-1',
      input: [[1]],
      expected: [1],
      comparator: { type: 'exact' },
      visibility: 'hidden',
      weight: 1,
      description: 'Single element',
    },
    {
      testId: 'hidden-2',
      input: [[-5000, 0, 5000]],
      expected: [5000, 0, -5000],
      comparator: { type: 'exact' },
      visibility: 'hidden',
      weight: 2,
      description: 'Boundary values',
    },
    {
      testId: 'hidden-3',
      input: [[1, 1, 1, 1]],
      expected: [1, 1, 1, 1],
      comparator: { type: 'exact' },
      visibility: 'hidden',
      weight: 1,
      description: 'All same values',
    },
    {
      testId: 'hidden-4',
      input: [[1, 2, 3, 4, 5, 6, 7, 8, 9, 10]],
      expected: [10, 9, 8, 7, 6, 5, 4, 3, 2, 1],
      comparator: { type: 'exact' },
      visibility: 'hidden',
      weight: 2,
      description: 'Ten elements',
    },
  ],

  referenceSolutions: {
    java: `class Solution {
    public ListNode reverseList(ListNode head) {
        ListNode prev = null;
        ListNode current = head;
        while (current != null) {
            ListNode next = current.next;
            current.next = prev;
            prev = current;
            current = next;
        }
        return prev;
    }
}`,
    javascript: `function reverseList(head) {
    let prev = null;
    let current = head;
    while (current !== null) {
        const next = current.next;
        current.next = prev;
        prev = current;
        current = next;
    }
    return prev;
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
                // Parse input: ListNode head (as int array)
                int[] arr = gson.fromJson(inputArr.get(0), int[].class);
                ListNode head = ListNode.fromArray(arr);
                
                // Call user's solution
                ListNode output = solution.reverseList(head);
                
                // Serialize output back to array
                List<Integer> outputArr = ListNode.toArray(output);
                
                result.put("status", "OK");
                result.put("output", outputArr);
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

import type { Problem } from './types';

/**
 * Add Two Numbers - LeetCode Problem #2
 * Difficulty: Medium
 * Topics: Linked List, Math, Recursion
 */
export const addTwoNumbers: Problem = {
  problemId: 'add-two-numbers',
  title: 'Add Two Numbers',
  difficulty: 'medium',
  topics: ['linked-list', 'math', 'recursion'],
  
  description: `You are given two **non-empty** linked lists representing two non-negative integers. The digits are stored in **reverse order**, and each of their nodes contains a single digit. Add the two numbers and return the sum as a linked list.

You may assume the two numbers do not contain any leading zero, except the number 0 itself.

**Example 1:**
\`\`\`
Input: l1 = [2,4,3], l2 = [5,6,4]
Output: [7,0,8]
Explanation: 342 + 465 = 807.
\`\`\`

**Example 2:**
\`\`\`
Input: l1 = [0], l2 = [0]
Output: [0]
\`\`\`

**Example 3:**
\`\`\`
Input: l1 = [9,9,9,9,9,9,9], l2 = [9,9,9,9]
Output: [8,9,9,9,0,0,0,1]
\`\`\``,

  constraints: [
    'The number of nodes in each linked list is in the range [1, 100].',
    '0 <= Node.val <= 9',
    'It is guaranteed that the list represents a number that does not have leading zeros.',
  ],

  inputSpec: {
    kind: 'tuple',
    elements: [
      { kind: 'linkedList' },
      { kind: 'linkedList' },
    ],
  },

  outputSpec: {
    kind: 'linkedList',
  },

  functionSignature: {
    name: 'addTwoNumbers',
    params: [
      { name: 'l1', type: 'ListNode', typeSpec: { kind: 'linkedList' } },
      { name: 'l2', type: 'ListNode', typeSpec: { kind: 'linkedList' } },
    ],
    returnType: 'ListNode',
    returnTypeSpec: { kind: 'linkedList' },
  },

  examples: [
    {
      input: [[2, 4, 3], [5, 6, 4]],
      output: [7, 0, 8],
      explanation: '342 + 465 = 807.',
    },
    {
      input: [[0], [0]],
      output: [0],
    },
    {
      input: [[9, 9, 9, 9, 9, 9, 9], [9, 9, 9, 9]],
      output: [8, 9, 9, 9, 0, 0, 0, 1],
    },
  ],

  tests: [
    // Visible tests
    {
      testId: 'visible-1',
      input: [[2, 4, 3], [5, 6, 4]],
      expected: [7, 0, 8],
      comparator: { type: 'exact' },
      visibility: 'visible',
      weight: 1,
      description: 'Basic addition with carry',
    },
    {
      testId: 'visible-2',
      input: [[0], [0]],
      expected: [0],
      comparator: { type: 'exact' },
      visibility: 'visible',
      weight: 1,
      description: 'Both zeros',
    },
    {
      testId: 'visible-3',
      input: [[9, 9, 9, 9, 9, 9, 9], [9, 9, 9, 9]],
      expected: [8, 9, 9, 9, 0, 0, 0, 1],
      comparator: { type: 'exact' },
      visibility: 'visible',
      weight: 1,
      description: 'Different lengths with many carries',
    },
    // Hidden tests
    {
      testId: 'hidden-1',
      input: [[1], [9, 9, 9]],
      expected: [0, 0, 0, 1],
      comparator: { type: 'exact' },
      visibility: 'hidden',
      weight: 2,
      description: 'Single digit + multi-digit with carries',
    },
    {
      testId: 'hidden-2',
      input: [[5], [5]],
      expected: [0, 1],
      comparator: { type: 'exact' },
      visibility: 'hidden',
      weight: 1,
      description: 'Single digits with carry',
    },
    {
      testId: 'hidden-3',
      input: [[1, 2, 3], [4, 5, 6]],
      expected: [5, 7, 9],
      comparator: { type: 'exact' },
      visibility: 'hidden',
      weight: 1,
      description: 'No carry needed',
    },
    {
      testId: 'hidden-4',
      input: [[9], [1, 9, 9, 9, 9, 9, 9, 9, 9, 9]],
      expected: [0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 1],
      comparator: { type: 'exact' },
      visibility: 'hidden',
      weight: 2,
      description: 'Large number with many nines',
    },
  ],

  referenceSolutions: {
    java: `class Solution {
    public ListNode addTwoNumbers(ListNode l1, ListNode l2) {
        ListNode dummy = new ListNode(0);
        ListNode current = dummy;
        int carry = 0;
        
        while (l1 != null || l2 != null || carry != 0) {
            int sum = carry;
            if (l1 != null) {
                sum += l1.val;
                l1 = l1.next;
            }
            if (l2 != null) {
                sum += l2.val;
                l2 = l2.next;
            }
            carry = sum / 10;
            current.next = new ListNode(sum % 10);
            current = current.next;
        }
        
        return dummy.next;
    }
}`,
    javascript: `function addTwoNumbers(l1, l2) {
    const dummy = { val: 0, next: null };
    let current = dummy;
    let carry = 0;
    
    while (l1 || l2 || carry) {
        let sum = carry;
        if (l1) {
            sum += l1.val;
            l1 = l1.next;
        }
        if (l2) {
            sum += l2.val;
            l2 = l2.next;
        }
        carry = Math.floor(sum / 10);
        current.next = { val: sum % 10, next: null };
        current = current.next;
    }
    
    return dummy.next;
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
                // Parse inputs: ListNode l1, ListNode l2 (as int arrays)
                int[] arr1 = gson.fromJson(inputArr.get(0), int[].class);
                int[] arr2 = gson.fromJson(inputArr.get(1), int[].class);
                ListNode l1 = ListNode.fromArray(arr1);
                ListNode l2 = ListNode.fromArray(arr2);
                
                // Call user's solution
                ListNode output = solution.addTwoNumbers(l1, l2);
                
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

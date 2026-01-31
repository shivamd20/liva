import type { Problem } from '../types';
import { starterCode as javaStarterCode, referenceSolution as javaReferenceSolution } from './java';

/**
 * Contains Duplicate - LeetCode Problem #217
 * 
 * Simple hash set problem for detecting duplicates.
 * 
 * Difficulty: Easy
 * Topics: Array, Hash Table, Sorting
 */
export const containsDuplicate: Problem = {
    problemId: 'contains-duplicate',
    title: 'Contains Duplicate',
    difficulty: 'easy',
    topics: ['array', 'hash-table', 'sorting'],

    description: `Given an integer array \`nums\`, return \`true\` if any value appears **at least twice** in the array, and return \`false\` if every element is distinct.

**Example 1:**
\`\`\`
Input: nums = [1,2,3,1]
Output: true
Explanation: The element 1 occurs at indices 0 and 3.
\`\`\`

**Example 2:**
\`\`\`
Input: nums = [1,2,3,4]
Output: false
Explanation: All elements are distinct.
\`\`\`

**Example 3:**
\`\`\`
Input: nums = [1,1,1,3,3,4,3,2,4,2]
Output: true
\`\`\``,

    constraints: [
        '1 <= nums.length <= 10^5',
        '-10^9 <= nums[i] <= 10^9',
    ],

    inputSpec: {
        kind: 'tuple',
        elements: [
            { kind: 'array', of: { kind: 'int' } },
        ],
    },

    outputSpec: { kind: 'boolean' },

    functionSignature: {
        name: 'containsDuplicate',
        params: [
            { name: 'nums', type: 'int[]', typeSpec: { kind: 'array', of: { kind: 'int' } } },
        ],
        returnType: 'boolean',
        returnTypeSpec: { kind: 'boolean' },
    },

    examples: [
        {
            input: [[1, 2, 3, 1]],
            output: true,
            explanation: 'The element 1 occurs at indices 0 and 3.',
        },
        {
            input: [[1, 2, 3, 4]],
            output: false,
            explanation: 'All elements are distinct.',
        },
        {
            input: [[1, 1, 1, 3, 3, 4, 3, 2, 4, 2]],
            output: true,
        },
    ],

    tests: [
        // Visible tests
        {
            testId: 'visible-1',
            input: [[1, 2, 3, 1]],
            expected: true,
            comparator: { type: 'exact' },
            visibility: 'visible',
            weight: 1,
            description: 'Basic duplicate at start and end',
        },
        {
            testId: 'visible-2',
            input: [[1, 2, 3, 4]],
            expected: false,
            comparator: { type: 'exact' },
            visibility: 'visible',
            weight: 1,
            description: 'All distinct elements',
        },
        {
            testId: 'visible-3',
            input: [[1, 1, 1, 3, 3, 4, 3, 2, 4, 2]],
            expected: true,
            comparator: { type: 'exact' },
            visibility: 'visible',
            weight: 1,
            description: 'Multiple duplicates',
        },
        // Hidden tests
        {
            testId: 'hidden-1',
            input: [[1]],
            expected: false,
            comparator: { type: 'exact' },
            visibility: 'hidden',
            weight: 2,
            description: 'Single element - no duplicate possible',
        },
        {
            testId: 'hidden-2',
            input: [[1, 1]],
            expected: true,
            comparator: { type: 'exact' },
            visibility: 'hidden',
            weight: 2,
            description: 'Two same elements',
        },
        {
            testId: 'hidden-3',
            input: [[0, 0, 0, 0]],
            expected: true,
            comparator: { type: 'exact' },
            visibility: 'hidden',
            weight: 1,
            description: 'All zeros',
        },
        {
            testId: 'hidden-4',
            input: [[-1, -2, -1]],
            expected: true,
            comparator: { type: 'exact' },
            visibility: 'hidden',
            weight: 2,
            description: 'Negative numbers with duplicate',
        },
        {
            testId: 'hidden-5',
            input: [[1000000000, -1000000000]],
            expected: false,
            comparator: { type: 'exact' },
            visibility: 'hidden',
            weight: 2,
            description: 'Large positive and negative - distinct',
        },
        {
            testId: 'hidden-6',
            input: [[1000000000, 1000000000]],
            expected: true,
            comparator: { type: 'exact' },
            visibility: 'hidden',
            weight: 2,
            description: 'Large numbers - duplicate',
        },
        {
            testId: 'hidden-7',
            input: [[1, 2, 3, 4, 5, 6, 7, 8, 9, 10]],
            expected: false,
            comparator: { type: 'exact' },
            visibility: 'hidden',
            weight: 1,
            description: 'Longer array - all distinct',
        },
    ],

    starterCode: {
        java: javaStarterCode,
    },

    referenceSolutions: {
        java: javaReferenceSolution,
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
                // Parse input: int[] nums
                int[] nums = gson.fromJson(inputArr.get(0), int[].class);
                
                // Call user's solution
                boolean output = solution.containsDuplicate(nums);
                
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

import type { Problem } from '../types';
import { starterCode as javaStarterCode, referenceSolution as javaReferenceSolution } from './java';

/**
 * Top K Frequent Elements - LeetCode Problem #347
 * 
 * Classic heap/bucket sort problem for finding most frequent elements.
 * 
 * Difficulty: Medium
 * Topics: Array, Hash Table, Divide and Conquer, Sorting, Heap, Bucket Sort
 */
export const topKFrequentElements: Problem = {
    problemId: 'top-k-frequent-elements',
    title: 'Top K Frequent Elements',
    difficulty: 'medium',
    topics: ['array', 'hash-table', 'heap', 'bucket-sort', 'sorting'],

    description: `Given an integer array \`nums\` and an integer \`k\`, return the \`k\` most frequent elements. You may return the answer in **any order**.

**Example 1:**
\`\`\`
Input: nums = [1,1,1,2,2,3], k = 2
Output: [1,2]
\`\`\`

**Example 2:**
\`\`\`
Input: nums = [1], k = 1
Output: [1]
\`\`\``,

    constraints: [
        '1 <= nums.length <= 10^5',
        '-10^4 <= nums[i] <= 10^4',
        'k is in the range [1, the number of unique elements in the array].',
        'It is guaranteed that the answer is unique.',
    ],

    inputSpec: {
        kind: 'tuple',
        elements: [
            { kind: 'array', of: { kind: 'int' } },
            { kind: 'int' },
        ],
    },

    outputSpec: {
        kind: 'array',
        of: { kind: 'int' },
    },

    functionSignature: {
        name: 'topKFrequent',
        params: [
            { name: 'nums', type: 'int[]', typeSpec: { kind: 'array', of: { kind: 'int' } } },
            { name: 'k', type: 'int', typeSpec: { kind: 'int' } },
        ],
        returnType: 'int[]',
        returnTypeSpec: { kind: 'array', of: { kind: 'int' } },
    },

    examples: [
        {
            input: [[1, 1, 1, 2, 2, 3], 2],
            output: [1, 2],
            explanation: '1 appears 3 times, 2 appears 2 times. These are the 2 most frequent.',
        },
        {
            input: [[1], 1],
            output: [1],
        },
    ],

    tests: [
        // Visible tests - use unorderedArray since order doesn't matter
        {
            testId: 'visible-1',
            input: [[1, 1, 1, 2, 2, 3], 2],
            expected: [1, 2],
            comparator: { type: 'unorderedArray' },
            visibility: 'visible',
            weight: 1,
            description: 'Standard example',
        },
        {
            testId: 'visible-2',
            input: [[1], 1],
            expected: [1],
            comparator: { type: 'unorderedArray' },
            visibility: 'visible',
            weight: 1,
            description: 'Single element',
        },
        {
            testId: 'visible-3',
            input: [[1, 2], 2],
            expected: [1, 2],
            comparator: { type: 'unorderedArray' },
            visibility: 'visible',
            weight: 1,
            description: 'Both elements appear once, k = 2',
        },
        // Hidden tests
        {
            testId: 'hidden-1',
            input: [[1, 1, 1, 1, 2, 2, 3, 3, 3], 2],
            expected: [1, 3],
            comparator: { type: 'unorderedArray' },
            visibility: 'hidden',
            weight: 2,
            description: 'Multiple frequencies - pick top 2',
        },
        {
            testId: 'hidden-2',
            input: [[-1, -1, -2, -2, -2], 1],
            expected: [-2],
            comparator: { type: 'unorderedArray' },
            visibility: 'hidden',
            weight: 2,
            description: 'Negative numbers',
        },
        {
            testId: 'hidden-3',
            input: [[4, 4, 4, 4], 1],
            expected: [4],
            comparator: { type: 'unorderedArray' },
            visibility: 'hidden',
            weight: 1,
            description: 'All same element',
        },
        {
            testId: 'hidden-4',
            input: [[1, 2, 3, 4, 5], 3],
            expected: [1, 2, 3],
            comparator: { type: 'unorderedArray' },
            visibility: 'hidden',
            weight: 2,
            description: 'All unique - any 3 valid (but we pick first 3)',
        },
        {
            testId: 'hidden-5',
            input: [[5, 5, 5, 5, 5, 1, 1, 1, 2, 2], 2],
            expected: [5, 1],
            comparator: { type: 'unorderedArray' },
            visibility: 'hidden',
            weight: 2,
            description: 'Clear frequency ordering',
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
                // Parse inputs: int[] nums, int k
                int[] nums = gson.fromJson(inputArr.get(0), int[].class);
                int k = inputArr.get(1).getAsInt();
                
                // Call user's solution
                int[] output = solution.topKFrequent(nums, k);
                
                // Sort for consistent comparison (since order doesn't matter)
                Arrays.sort(output);
                
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

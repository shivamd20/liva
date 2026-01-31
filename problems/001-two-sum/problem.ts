import type { Problem } from '../types';
import { starterCode as javaStarterCode, referenceSolution as javaReferenceSolution } from './java';

/**
 * Two Sum - LeetCode Problem #1
 * 
 * The classic interview problem. Given an array and a target,
 * find two numbers that add up to the target.
 * 
 * Difficulty: Easy
 * Topics: Array, Hash Table
 */
export const twoSum: Problem = {
    problemId: 'two-sum',
    title: 'Two Sum',
    difficulty: 'easy',
    topics: ['array', 'hash-table'],

    description: `Given an array of integers \`nums\` and an integer \`target\`, return *indices of the two numbers such that they add up to \`target\`*.

You may assume that each input would have **exactly one solution**, and you may not use the same element twice.

You can return the answer in any order.

**Example 1:**
\`\`\`
Input: nums = [2,7,11,15], target = 9
Output: [0,1]
Explanation: Because nums[0] + nums[1] == 9, we return [0, 1].
\`\`\`

**Example 2:**
\`\`\`
Input: nums = [3,2,4], target = 6
Output: [1,2]
\`\`\`

**Example 3:**
\`\`\`
Input: nums = [3,3], target = 6
Output: [0,1]
\`\`\``,

    constraints: [
        '2 <= nums.length <= 10^4',
        '-10^9 <= nums[i] <= 10^9',
        '-10^9 <= target <= 10^9',
        'Only one valid answer exists.',
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
        name: 'twoSum',
        params: [
            { name: 'nums', type: 'int[]', typeSpec: { kind: 'array', of: { kind: 'int' } } },
            { name: 'target', type: 'int', typeSpec: { kind: 'int' } },
        ],
        returnType: 'int[]',
        returnTypeSpec: { kind: 'array', of: { kind: 'int' } },
    },

    examples: [
        {
            input: [[2, 7, 11, 15], 9],
            output: [0, 1],
            explanation: 'Because nums[0] + nums[1] == 9, we return [0, 1].',
        },
        {
            input: [[3, 2, 4], 6],
            output: [1, 2],
        },
        {
            input: [[3, 3], 6],
            output: [0, 1],
        },
    ],

    tests: [
        // Visible tests (shown to user) - 3 from examples
        {
            testId: 'visible-1',
            input: [[2, 7, 11, 15], 9],
            expected: [0, 1],
            comparator: { type: 'unorderedArray' },
            visibility: 'visible',
            weight: 1,
            description: 'Basic case from example 1',
        },
        {
            testId: 'visible-2',
            input: [[3, 2, 4], 6],
            expected: [1, 2],
            comparator: { type: 'unorderedArray' },
            visibility: 'visible',
            weight: 1,
            description: 'Basic case from example 2',
        },
        {
            testId: 'visible-3',
            input: [[3, 3], 6],
            expected: [0, 1],
            comparator: { type: 'unorderedArray' },
            visibility: 'visible',
            weight: 1,
            description: 'Same element value at different indices',
        },
        // Hidden tests - edge cases
        {
            testId: 'hidden-1',
            input: [[-1, -2, -3, -4, -5], -8],
            expected: [2, 4],
            comparator: { type: 'unorderedArray' },
            visibility: 'hidden',
            weight: 2,
            description: 'All negative numbers',
        },
        {
            testId: 'hidden-2',
            input: [[0, 4, 3, 0], 0],
            expected: [0, 3],
            comparator: { type: 'unorderedArray' },
            visibility: 'hidden',
            weight: 2,
            description: 'Target is zero, result includes zeros',
        },
        {
            testId: 'hidden-3',
            input: [[1000000000, -1000000000, 3, 4], 0],
            expected: [0, 1],
            comparator: { type: 'unorderedArray' },
            visibility: 'hidden',
            weight: 2,
            description: 'Large positive and negative numbers',
        },
        {
            testId: 'hidden-4',
            input: [[1, 2], 3],
            expected: [0, 1],
            comparator: { type: 'unorderedArray' },
            visibility: 'hidden',
            weight: 1,
            description: 'Minimum array size',
        },
        {
            testId: 'hidden-5',
            input: [[5, 75, 25], 100],
            expected: [1, 2],
            comparator: { type: 'unorderedArray' },
            visibility: 'hidden',
            weight: 1,
            description: 'Answer not at start',
        },
        {
            testId: 'hidden-6',
            input: [[1, 5, 5, 3], 10],
            expected: [1, 2],
            comparator: { type: 'unorderedArray' },
            visibility: 'hidden',
            weight: 2,
            description: 'Duplicate values in array where both are needed',
        },
        {
            testId: 'hidden-7',
            input: [[-3, 4, 3, 90], 0],
            expected: [0, 2],
            comparator: { type: 'unorderedArray' },
            visibility: 'hidden',
            weight: 2,
            description: 'Negative and positive adding to zero',
        },
    ],

    // Starter code - what users see when they start the problem
    starterCode: {
        java: javaStarterCode,
    },

    // Reference solution - used to verify test cases
    referenceSolutions: {
        java: javaReferenceSolution,
    },

    timeLimit: 2000,
    memoryLimit: 256,

    javaHarness: `import com.google.gson.*;
import java.util.*;

public class Main {
    public static void main(String[] args) {
        // Read all stdin
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
                // Parse inputs: int[] nums, int target
                int[] nums = gson.fromJson(inputArr.get(0), int[].class);
                int target = inputArr.get(1).getAsInt();
                
                // Call user's solution
                int[] output = solution.twoSum(nums, target);
                
                result.put("status", "OK");
                result.put("output", output);
            } catch (Exception e) {
                result.put("status", "ERROR");
                result.put("error", e.getClass().getSimpleName() + ": " + e.getMessage());
            }
            
            results.add(result);
        }
        
        // Build response
        Map<String, Object> response = new LinkedHashMap<>();
        response.put("results", results);
        response.put("meta", Map.of("timeMs", System.currentTimeMillis()));
        
        // Emit sentinel-delimited output
        System.out.println("<<<JUDGE_OUTPUT_V1_BEGIN>>>");
        System.out.println(gson.toJson(response));
        System.out.println("<<<JUDGE_OUTPUT_V1_END>>>");
    }
}`,
};

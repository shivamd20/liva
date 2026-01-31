import type { Problem } from '../types';
import { starterCode as javaStarterCode, referenceSolution as javaReferenceSolution } from './java';

/**
 * Best Time to Buy and Sell Stock - LeetCode Problem #121
 * 
 * Classic dynamic programming / greedy problem.
 * 
 * Difficulty: Easy
 * Topics: Array, Dynamic Programming
 */
export const bestTimeToBuyAndSellStock: Problem = {
    problemId: 'best-time-to-buy-and-sell-stock',
    title: 'Best Time to Buy and Sell Stock',
    difficulty: 'easy',
    topics: ['array', 'dynamic-programming'],

    description: `You are given an array \`prices\` where \`prices[i]\` is the price of a given stock on the \`ith\` day.

You want to maximize your profit by choosing a **single day** to buy one stock and choosing a **different day in the future** to sell that stock.

Return the *maximum profit you can achieve from this transaction*. If you cannot achieve any profit, return \`0\`.

**Example 1:**
\`\`\`
Input: prices = [7,1,5,3,6,4]
Output: 5
Explanation: Buy on day 2 (price = 1) and sell on day 5 (price = 6), profit = 6-1 = 5.
\`\`\`

**Example 2:**
\`\`\`
Input: prices = [7,6,4,3,1]
Output: 0
Explanation: No transactions done - prices only decrease.
\`\`\``,

    constraints: [
        '1 <= prices.length <= 10^5',
        '0 <= prices[i] <= 10^4',
    ],

    inputSpec: { kind: 'tuple', elements: [{ kind: 'array', of: { kind: 'int' } }] },
    outputSpec: { kind: 'int' },

    functionSignature: {
        name: 'maxProfit',
        params: [{ name: 'prices', type: 'int[]', typeSpec: { kind: 'array', of: { kind: 'int' } } }],
        returnType: 'int',
        returnTypeSpec: { kind: 'int' },
    },

    examples: [
        { input: [[7, 1, 5, 3, 6, 4]], output: 5 },
        { input: [[7, 6, 4, 3, 1]], output: 0 },
    ],

    tests: [
        { testId: 'visible-1', input: [[7, 1, 5, 3, 6, 4]], expected: 5, comparator: { type: 'exact' }, visibility: 'visible', weight: 1 },
        { testId: 'visible-2', input: [[7, 6, 4, 3, 1]], expected: 0, comparator: { type: 'exact' }, visibility: 'visible', weight: 1 },
        { testId: 'visible-3', input: [[1, 2]], expected: 1, comparator: { type: 'exact' }, visibility: 'visible', weight: 1 },
        { testId: 'hidden-1', input: [[2, 1]], expected: 0, comparator: { type: 'exact' }, visibility: 'hidden', weight: 2, description: 'Decreasing - no profit' },
        { testId: 'hidden-2', input: [[1]], expected: 0, comparator: { type: 'exact' }, visibility: 'hidden', weight: 2, description: 'Single element' },
        { testId: 'hidden-3', input: [[1, 1, 1, 1]], expected: 0, comparator: { type: 'exact' }, visibility: 'hidden', weight: 1, description: 'All same' },
        { testId: 'hidden-4', input: [[3, 2, 6, 5, 0, 3]], expected: 4, comparator: { type: 'exact' }, visibility: 'hidden', weight: 2 },
        { testId: 'hidden-5', input: [[2, 4, 1]], expected: 2, comparator: { type: 'exact' }, visibility: 'hidden', weight: 2 },
    ],

    starterCode: { java: javaStarterCode },
    referenceSolutions: { java: javaReferenceSolution },
    timeLimit: 2000,
    memoryLimit: 256,

    javaHarness: `import com.google.gson.*;
import java.util.*;

public class Main {
    public static void main(String[] args) {
        Scanner sc = new Scanner(System.in);
        StringBuilder sb = new StringBuilder();
        while (sc.hasNextLine()) { sb.append(sc.nextLine()); }
        
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
                int[] prices = gson.fromJson(inputArr.get(0), int[].class);
                int output = solution.maxProfit(prices);
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

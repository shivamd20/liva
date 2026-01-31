import type { Problem } from '../types';
import { starterCode as javaStarterCode, referenceSolution as javaReferenceSolution } from './java';

/**
 * Valid Palindrome - LeetCode Problem #125
 * 
 * Classic two pointers problem for string processing.
 * 
 * Difficulty: Easy
 * Topics: Two Pointers, String
 */
export const validPalindrome: Problem = {
    problemId: 'valid-palindrome',
    title: 'Valid Palindrome',
    difficulty: 'easy',
    topics: ['two-pointers', 'string'],

    description: `A phrase is a **palindrome** if, after converting all uppercase letters into lowercase letters and removing all non-alphanumeric characters, it reads the same forward and backward. Alphanumeric characters include letters and numbers.

Given a string \`s\`, return \`true\` if it is a **palindrome**, or \`false\` otherwise.

**Example 1:**
\`\`\`
Input: s = "A man, a plan, a canal: Panama"
Output: true
Explanation: "amanaplanacanalpanama" is a palindrome.
\`\`\`

**Example 2:**
\`\`\`
Input: s = "race a car"
Output: false
Explanation: "raceacar" is not a palindrome.
\`\`\`

**Example 3:**
\`\`\`
Input: s = " "
Output: true
Explanation: After removing non-alphanumeric, it's an empty string "", which is a palindrome.
\`\`\``,

    constraints: [
        '1 <= s.length <= 2 * 10^5',
        's consists only of printable ASCII characters.',
    ],

    inputSpec: { kind: 'tuple', elements: [{ kind: 'string' }] },
    outputSpec: { kind: 'boolean' },

    functionSignature: {
        name: 'isPalindrome',
        params: [{ name: 's', type: 'String', typeSpec: { kind: 'string' } }],
        returnType: 'boolean',
        returnTypeSpec: { kind: 'boolean' },
    },

    examples: [
        { input: ['A man, a plan, a canal: Panama'], output: true },
        { input: ['race a car'], output: false },
        { input: [' '], output: true },
    ],

    tests: [
        { testId: 'visible-1', input: ['A man, a plan, a canal: Panama'], expected: true, comparator: { type: 'exact' }, visibility: 'visible', weight: 1 },
        { testId: 'visible-2', input: ['race a car'], expected: false, comparator: { type: 'exact' }, visibility: 'visible', weight: 1 },
        { testId: 'visible-3', input: [' '], expected: true, comparator: { type: 'exact' }, visibility: 'visible', weight: 1 },
        { testId: 'hidden-1', input: [''], expected: true, comparator: { type: 'exact' }, visibility: 'hidden', weight: 2, description: 'Empty string' },
        { testId: 'hidden-2', input: ['a'], expected: true, comparator: { type: 'exact' }, visibility: 'hidden', weight: 1 },
        { testId: 'hidden-3', input: ['0P'], expected: false, comparator: { type: 'exact' }, visibility: 'hidden', weight: 2 },
        { testId: 'hidden-4', input: ['aa'], expected: true, comparator: { type: 'exact' }, visibility: 'hidden', weight: 1 },
        { testId: 'hidden-5', input: ['ab'], expected: false, comparator: { type: 'exact' }, visibility: 'hidden', weight: 1 },
        { testId: 'hidden-6', input: ['.,'], expected: true, comparator: { type: 'exact' }, visibility: 'hidden', weight: 2, description: 'Only punctuation' },
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
                String s = inputArr.get(0).getAsString();
                boolean output = solution.isPalindrome(s);
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

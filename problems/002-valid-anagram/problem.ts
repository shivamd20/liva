import type { Problem } from '../types';
import { starterCode as javaStarterCode, referenceSolution as javaReferenceSolution } from './java';

/**
 * Valid Anagram - LeetCode Problem #242
 * 
 * Classic string manipulation problem testing character frequency.
 * 
 * Difficulty: Easy
 * Topics: Hash Table, String, Sorting
 */
export const validAnagram: Problem = {
    problemId: 'valid-anagram',
    title: 'Valid Anagram',
    difficulty: 'easy',
    topics: ['hash-table', 'string', 'sorting'],

    description: `Given two strings \`s\` and \`t\`, return \`true\` if \`t\` is an **anagram** of \`s\`, and \`false\` otherwise.

An **Anagram** is a word or phrase formed by rearranging the letters of a different word or phrase, typically using all the original letters exactly once.

**Example 1:**
\`\`\`
Input: s = "anagram", t = "nagaram"
Output: true
\`\`\`

**Example 2:**
\`\`\`
Input: s = "rat", t = "car"
Output: false
\`\`\``,

    constraints: [
        '1 <= s.length, t.length <= 5 * 10^4',
        's and t consist of lowercase English letters.',
    ],

    inputSpec: {
        kind: 'tuple',
        elements: [
            { kind: 'string' },
            { kind: 'string' },
        ],
    },

    outputSpec: { kind: 'boolean' },

    functionSignature: {
        name: 'isAnagram',
        params: [
            { name: 's', type: 'String', typeSpec: { kind: 'string' } },
            { name: 't', type: 'String', typeSpec: { kind: 'string' } },
        ],
        returnType: 'boolean',
        returnTypeSpec: { kind: 'boolean' },
    },

    examples: [
        {
            input: ['anagram', 'nagaram'],
            output: true,
            explanation: '"nagaram" is an anagram of "anagram".',
        },
        {
            input: ['rat', 'car'],
            output: false,
            explanation: '"car" is not an anagram of "rat".',
        },
    ],

    tests: [
        // Visible tests (from examples)
        {
            testId: 'visible-1',
            input: ['anagram', 'nagaram'],
            expected: true,
            comparator: { type: 'exact' },
            visibility: 'visible',
            weight: 1,
            description: 'Basic anagram case',
        },
        {
            testId: 'visible-2',
            input: ['rat', 'car'],
            expected: false,
            comparator: { type: 'exact' },
            visibility: 'visible',
            weight: 1,
            description: 'Not an anagram - different letters',
        },
        {
            testId: 'visible-3',
            input: ['a', 'a'],
            expected: true,
            comparator: { type: 'exact' },
            visibility: 'visible',
            weight: 1,
            description: 'Single character - same',
        },
        // Hidden tests
        {
            testId: 'hidden-1',
            input: ['ab', 'a'],
            expected: false,
            comparator: { type: 'exact' },
            visibility: 'hidden',
            weight: 2,
            description: 'Different lengths',
        },
        {
            testId: 'hidden-2',
            input: ['', ''],
            expected: true,
            comparator: { type: 'exact' },
            visibility: 'hidden',
            weight: 2,
            description: 'Empty strings',
        },
        {
            testId: 'hidden-3',
            input: ['aacc', 'ccac'],
            expected: false,
            comparator: { type: 'exact' },
            visibility: 'hidden',
            weight: 2,
            description: 'Same letters but different frequencies',
        },
        {
            testId: 'hidden-4',
            input: ['aabb', 'bbaa'],
            expected: true,
            comparator: { type: 'exact' },
            visibility: 'hidden',
            weight: 1,
            description: 'Reversed order anagram',
        },
        {
            testId: 'hidden-5',
            input: ['listen', 'silent'],
            expected: true,
            comparator: { type: 'exact' },
            visibility: 'hidden',
            weight: 1,
            description: 'Classic anagram example',
        },
        {
            testId: 'hidden-6',
            input: ['aaaaaa', 'aaaaaa'],
            expected: true,
            comparator: { type: 'exact' },
            visibility: 'hidden',
            weight: 1,
            description: 'All same characters',
        },
        {
            testId: 'hidden-7',
            input: ['abcdefghijklmnopqrstuvwxyz', 'zyxwvutsrqponmlkjihgfedcba'],
            expected: true,
            comparator: { type: 'exact' },
            visibility: 'hidden',
            weight: 2,
            description: 'All 26 letters - reversed',
        },
        {
            testId: 'hidden-8',
            input: ['ab', 'ba'],
            expected: true,
            comparator: { type: 'exact' },
            visibility: 'hidden',
            weight: 1,
            description: 'Two characters swapped',
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
                // Parse inputs: String s, String t
                String s = inputArr.get(0).getAsString();
                String t = inputArr.get(1).getAsString();
                
                // Call user's solution
                boolean output = solution.isAnagram(s, t);
                
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

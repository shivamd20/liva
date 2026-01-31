import type { Problem } from '../types';
import { starterCode as javaStarterCode, referenceSolution as javaReferenceSolution } from './java';

/**
 * Group Anagrams - LeetCode Problem #49
 * 
 * Classic hash table problem for grouping strings by anagram signature.
 * 
 * Difficulty: Medium
 * Topics: Array, Hash Table, String, Sorting
 */
export const groupAnagrams: Problem = {
    problemId: 'group-anagrams',
    title: 'Group Anagrams',
    difficulty: 'medium',
    topics: ['array', 'hash-table', 'string', 'sorting'],

    description: `Given an array of strings \`strs\`, group the **anagrams** together. You can return the answer in **any order**.

An **Anagram** is a word or phrase formed by rearranging the letters of a different word or phrase, typically using all the original letters exactly once.

**Example 1:**
\`\`\`
Input: strs = ["eat","tea","tan","ate","nat","bat"]
Output: [["bat"],["nat","tan"],["ate","eat","tea"]]
Explanation: The groupings are not necessarily sorted.
\`\`\`

**Example 2:**
\`\`\`
Input: strs = [""]
Output: [[""]]
\`\`\`

**Example 3:**
\`\`\`
Input: strs = ["a"]
Output: [["a"]]
\`\`\``,

    constraints: [
        '1 <= strs.length <= 10^4',
        '0 <= strs[i].length <= 100',
        'strs[i] consists of lowercase English letters.',
    ],

    inputSpec: {
        kind: 'tuple',
        elements: [
            { kind: 'array', of: { kind: 'string' } },
        ],
    },

    outputSpec: {
        kind: 'array',
        of: { kind: 'array', of: { kind: 'string' } },
    },

    functionSignature: {
        name: 'groupAnagrams',
        params: [
            { name: 'strs', type: 'String[]', typeSpec: { kind: 'array', of: { kind: 'string' } } },
        ],
        returnType: 'List<List<String>>',
        returnTypeSpec: { kind: 'array', of: { kind: 'array', of: { kind: 'string' } } },
    },

    examples: [
        {
            input: [['eat', 'tea', 'tan', 'ate', 'nat', 'bat']],
            output: [['bat'], ['nat', 'tan'], ['ate', 'eat', 'tea']],
            explanation: 'The groupings are based on anagram signatures.',
        },
        {
            input: [['']],
            output: [['']],
        },
        {
            input: [['a']],
            output: [['a']],
        },
    ],

    tests: [
        // Visible tests - use multiset comparator for groups (order doesn't matter)
        {
            testId: 'visible-1',
            input: [['eat', 'tea', 'tan', 'ate', 'nat', 'bat']],
            expected: [['bat'], ['nat', 'tan'], ['ate', 'eat', 'tea']],
            comparator: { type: 'multiset' },
            visibility: 'visible',
            weight: 1,
            description: 'Standard example with multiple groups',
        },
        {
            testId: 'visible-2',
            input: [['']],
            expected: [['']],
            comparator: { type: 'multiset' },
            visibility: 'visible',
            weight: 1,
            description: 'Single empty string',
        },
        {
            testId: 'visible-3',
            input: [['a']],
            expected: [['a']],
            comparator: { type: 'multiset' },
            visibility: 'visible',
            weight: 1,
            description: 'Single character',
        },
        // Hidden tests
        {
            testId: 'hidden-1',
            input: [['abc', 'bca', 'cab', 'xyz', 'zyx']],
            expected: [['abc', 'bca', 'cab'], ['xyz', 'zyx']],
            comparator: { type: 'multiset' },
            visibility: 'hidden',
            weight: 2,
            description: 'Two distinct anagram groups',
        },
        {
            testId: 'hidden-2',
            input: [['', '', '']],
            expected: [['', '', '']],
            comparator: { type: 'multiset' },
            visibility: 'hidden',
            weight: 2,
            description: 'Multiple empty strings - same group',
        },
        {
            testId: 'hidden-3',
            input: [['abc', 'def', 'ghi']],
            expected: [['abc'], ['def'], ['ghi']],
            comparator: { type: 'multiset' },
            visibility: 'hidden',
            weight: 2,
            description: 'All unique - no anagrams',
        },
        {
            testId: 'hidden-4',
            input: [['aaa', 'aaa', 'aaa']],
            expected: [['aaa', 'aaa', 'aaa']],
            comparator: { type: 'multiset' },
            visibility: 'hidden',
            weight: 1,
            description: 'All same strings',
        },
        {
            testId: 'hidden-5',
            input: [['ab', 'ba', 'ab', 'ba']],
            expected: [['ab', 'ba', 'ab', 'ba']],
            comparator: { type: 'multiset' },
            visibility: 'hidden',
            weight: 2,
            description: 'Repeated anagrams in same group',
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
                // Parse input: String[] strs
                String[] strs = gson.fromJson(inputArr.get(0), String[].class);
                
                // Call user's solution
                List<List<String>> output = solution.groupAnagrams(strs);
                
                // Sort each inner list and the outer list for consistent comparison
                for (List<String> group : output) {
                    Collections.sort(group);
                }
                output.sort((a, b) -> {
                    if (a.isEmpty() && b.isEmpty()) return 0;
                    if (a.isEmpty()) return -1;
                    if (b.isEmpty()) return 1;
                    return a.get(0).compareTo(b.get(0));
                });
                
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

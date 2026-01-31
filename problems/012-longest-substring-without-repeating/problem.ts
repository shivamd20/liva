import type { Problem } from '../types';
import { starterCode as javaStarterCode, referenceSolution as javaReferenceSolution } from './java';

export const longestSubstringWithoutRepeating: Problem = {
    problemId: 'longest-substring-without-repeating',
    title: 'Longest Substring Without Repeating Characters',
    difficulty: 'medium',
    topics: ['hash-table', 'string', 'sliding-window'],
    description: `Given a string \`s\`, find the length of the **longest substring** without repeating characters.

**Example 1:**
\`\`\`
Input: s = "abcabcbb"
Output: 3
Explanation: The answer is "abc", with the length of 3.
\`\`\`

**Example 2:**
\`\`\`
Input: s = "bbbbb"
Output: 1
Explanation: The answer is "b", with the length of 1.
\`\`\`

**Example 3:**
\`\`\`
Input: s = "pwwkew"
Output: 3
Explanation: The answer is "wke", with the length of 3.
\`\`\``,
    constraints: ['0 <= s.length <= 5 * 10^4', 's consists of English letters, digits, symbols and spaces.'],
    inputSpec: { kind: 'tuple', elements: [{ kind: 'string' }] },
    outputSpec: { kind: 'int' },
    functionSignature: { name: 'lengthOfLongestSubstring', params: [{ name: 's', type: 'String', typeSpec: { kind: 'string' } }], returnType: 'int', returnTypeSpec: { kind: 'int' } },
    examples: [{ input: ['abcabcbb'], output: 3 }, { input: ['bbbbb'], output: 1 }, { input: ['pwwkew'], output: 3 }],
    tests: [
        { testId: 'visible-1', input: ['abcabcbb'], expected: 3, comparator: { type: 'exact' }, visibility: 'visible', weight: 1 },
        { testId: 'visible-2', input: ['bbbbb'], expected: 1, comparator: { type: 'exact' }, visibility: 'visible', weight: 1 },
        { testId: 'visible-3', input: ['pwwkew'], expected: 3, comparator: { type: 'exact' }, visibility: 'visible', weight: 1 },
        { testId: 'hidden-1', input: [''], expected: 0, comparator: { type: 'exact' }, visibility: 'hidden', weight: 2, description: 'Empty string' },
        { testId: 'hidden-2', input: [' '], expected: 1, comparator: { type: 'exact' }, visibility: 'hidden', weight: 1, description: 'Single space' },
        { testId: 'hidden-3', input: ['abcdef'], expected: 6, comparator: { type: 'exact' }, visibility: 'hidden', weight: 1, description: 'All unique' },
        { testId: 'hidden-4', input: ['aab'], expected: 2, comparator: { type: 'exact' }, visibility: 'hidden', weight: 2 },
    ],
    starterCode: { java: javaStarterCode },
    referenceSolutions: { java: javaReferenceSolution },
    timeLimit: 2000, memoryLimit: 256,
    javaHarness: `import com.google.gson.*;import java.util.*;public class Main{public static void main(String[] args){Scanner sc=new Scanner(System.in);StringBuilder sb=new StringBuilder();while(sc.hasNextLine())sb.append(sc.nextLine());Gson gson=new Gson();JsonObject input=JsonParser.parseString(sb.toString()).getAsJsonObject();JsonArray testcases=input.getAsJsonArray("testcases");List<Map<String,Object>> results=new ArrayList<>();UserSolution solution=new UserSolution();for(JsonElement tc:testcases){JsonObject testcase=tc.getAsJsonObject();int id=testcase.get("id").getAsInt();JsonArray inputArr=testcase.getAsJsonArray("input");Map<String,Object> result=new LinkedHashMap<>();result.put("case",id);try{String s=inputArr.get(0).getAsString();int output=solution.lengthOfLongestSubstring(s);result.put("status","OK");result.put("output",output);}catch(Exception e){result.put("status","ERROR");result.put("error",e.getClass().getSimpleName()+": "+e.getMessage());}results.add(result);}Map<String,Object> response=new LinkedHashMap<>();response.put("results",results);response.put("meta",Map.of("timeMs",System.currentTimeMillis()));System.out.println("<<<JUDGE_OUTPUT_V1_BEGIN>>>");System.out.println(gson.toJson(response));System.out.println("<<<JUDGE_OUTPUT_V1_END>>>");}}`,
};

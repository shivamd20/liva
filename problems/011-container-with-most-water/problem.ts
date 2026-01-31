import type { Problem } from '../types';
import { starterCode as javaStarterCode, referenceSolution as javaReferenceSolution } from './java';

export const containerWithMostWater: Problem = {
    problemId: 'container-with-most-water',
    title: 'Container With Most Water',
    difficulty: 'medium',
    topics: ['array', 'two-pointers', 'greedy'],
    description: `You are given an integer array \`height\` of length \`n\`. There are \`n\` vertical lines drawn such that the two endpoints of the \`ith\` line are \`(i, 0)\` and \`(i, height[i])\`.

Find two lines that together with the x-axis form a container, such that the container contains the most water.

Return the *maximum amount of water* a container can store.

**Example 1:**
\`\`\`
Input: height = [1,8,6,2,5,4,8,3,7]
Output: 49
Explanation: Width = 7 (between index 1 and 8), Height = min(8,7) = 7, Area = 7 * 7 = 49.
\`\`\`

**Example 2:**
\`\`\`
Input: height = [1,1]
Output: 1
\`\`\``,
    constraints: ['n == height.length', '2 <= n <= 10^5', '0 <= height[i] <= 10^4'],
    inputSpec: { kind: 'tuple', elements: [{ kind: 'array', of: { kind: 'int' } }] },
    outputSpec: { kind: 'int' },
    functionSignature: { name: 'maxArea', params: [{ name: 'height', type: 'int[]', typeSpec: { kind: 'array', of: { kind: 'int' } } }], returnType: 'int', returnTypeSpec: { kind: 'int' } },
    examples: [{ input: [[1, 8, 6, 2, 5, 4, 8, 3, 7]], output: 49 }, { input: [[1, 1]], output: 1 }],
    tests: [
        { testId: 'visible-1', input: [[1, 8, 6, 2, 5, 4, 8, 3, 7]], expected: 49, comparator: { type: 'exact' }, visibility: 'visible', weight: 1 },
        { testId: 'visible-2', input: [[1, 1]], expected: 1, comparator: { type: 'exact' }, visibility: 'visible', weight: 1 },
        { testId: 'hidden-1', input: [[4, 3, 2, 1, 4]], expected: 16, comparator: { type: 'exact' }, visibility: 'hidden', weight: 2 },
        { testId: 'hidden-2', input: [[1, 2, 1]], expected: 2, comparator: { type: 'exact' }, visibility: 'hidden', weight: 2 },
        { testId: 'hidden-3', input: [[2, 3, 10, 5, 7, 8, 9]], expected: 36, comparator: { type: 'exact' }, visibility: 'hidden', weight: 2 },
    ],
    starterCode: { java: javaStarterCode },
    referenceSolutions: { java: javaReferenceSolution },
    timeLimit: 2000, memoryLimit: 256,
    javaHarness: `import com.google.gson.*;import java.util.*;public class Main{public static void main(String[] args){Scanner sc=new Scanner(System.in);StringBuilder sb=new StringBuilder();while(sc.hasNextLine())sb.append(sc.nextLine());Gson gson=new Gson();JsonObject input=JsonParser.parseString(sb.toString()).getAsJsonObject();JsonArray testcases=input.getAsJsonArray("testcases");List<Map<String,Object>> results=new ArrayList<>();UserSolution solution=new UserSolution();for(JsonElement tc:testcases){JsonObject testcase=tc.getAsJsonObject();int id=testcase.get("id").getAsInt();JsonArray inputArr=testcase.getAsJsonArray("input");Map<String,Object> result=new LinkedHashMap<>();result.put("case",id);try{int[] height=gson.fromJson(inputArr.get(0),int[].class);int output=solution.maxArea(height);result.put("status","OK");result.put("output",output);}catch(Exception e){result.put("status","ERROR");result.put("error",e.getClass().getSimpleName()+": "+e.getMessage());}results.add(result);}Map<String,Object> response=new LinkedHashMap<>();response.put("results",results);response.put("meta",Map.of("timeMs",System.currentTimeMillis()));System.out.println("<<<JUDGE_OUTPUT_V1_BEGIN>>>");System.out.println(gson.toJson(response));System.out.println("<<<JUDGE_OUTPUT_V1_END>>>");}}`,
};

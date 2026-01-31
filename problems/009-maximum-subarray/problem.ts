import type { Problem } from '../types';
import { starterCode as javaStarterCode, referenceSolution as javaReferenceSolution } from './java';

export const maximumSubarray: Problem = {
    problemId: 'maximum-subarray',
    title: 'Maximum Subarray',
    difficulty: 'medium',
    topics: ['array', 'dynamic-programming', 'divide-and-conquer'],

    description: `Given an integer array \`nums\`, find the subarray with the largest sum, and return its sum.

**Example 1:**
\`\`\`
Input: nums = [-2,1,-3,4,-1,2,1,-5,4]
Output: 6
Explanation: The subarray [4,-1,2,1] has the largest sum 6.
\`\`\`

**Example 2:**
\`\`\`
Input: nums = [1]
Output: 1
\`\`\`

**Example 3:**
\`\`\`
Input: nums = [5,4,-1,7,8]
Output: 23
Explanation: The subarray [5,4,-1,7,8] has the largest sum 23.
\`\`\``,

    constraints: ['1 <= nums.length <= 10^5', '-10^4 <= nums[i] <= 10^4'],
    inputSpec: { kind: 'tuple', elements: [{ kind: 'array', of: { kind: 'int' } }] },
    outputSpec: { kind: 'int' },
    functionSignature: { name: 'maxSubArray', params: [{ name: 'nums', type: 'int[]', typeSpec: { kind: 'array', of: { kind: 'int' } } }], returnType: 'int', returnTypeSpec: { kind: 'int' } },
    examples: [{ input: [[-2, 1, -3, 4, -1, 2, 1, -5, 4]], output: 6 }, { input: [[1]], output: 1 }, { input: [[5, 4, -1, 7, 8]], output: 23 }],
    tests: [
        { testId: 'visible-1', input: [[-2, 1, -3, 4, -1, 2, 1, -5, 4]], expected: 6, comparator: { type: 'exact' }, visibility: 'visible', weight: 1 },
        { testId: 'visible-2', input: [[1]], expected: 1, comparator: { type: 'exact' }, visibility: 'visible', weight: 1 },
        { testId: 'visible-3', input: [[5, 4, -1, 7, 8]], expected: 23, comparator: { type: 'exact' }, visibility: 'visible', weight: 1 },
        { testId: 'hidden-1', input: [[-1]], expected: -1, comparator: { type: 'exact' }, visibility: 'hidden', weight: 2, description: 'Single negative' },
        { testId: 'hidden-2', input: [[-2, -1]], expected: -1, comparator: { type: 'exact' }, visibility: 'hidden', weight: 2, description: 'All negatives' },
        { testId: 'hidden-3', input: [[1, 2, 3, 4, 5]], expected: 15, comparator: { type: 'exact' }, visibility: 'hidden', weight: 1, description: 'All positive' },
        { testId: 'hidden-4', input: [[0, 0, 0]], expected: 0, comparator: { type: 'exact' }, visibility: 'hidden', weight: 1, description: 'All zeros' },
    ],
    starterCode: { java: javaStarterCode },
    referenceSolutions: { java: javaReferenceSolution },
    timeLimit: 2000, memoryLimit: 256,
    javaHarness: `import com.google.gson.*;import java.util.*;public class Main{public static void main(String[] args){Scanner sc=new Scanner(System.in);StringBuilder sb=new StringBuilder();while(sc.hasNextLine())sb.append(sc.nextLine());Gson gson=new Gson();JsonObject input=JsonParser.parseString(sb.toString()).getAsJsonObject();JsonArray testcases=input.getAsJsonArray("testcases");List<Map<String,Object>> results=new ArrayList<>();UserSolution solution=new UserSolution();for(JsonElement tc:testcases){JsonObject testcase=tc.getAsJsonObject();int id=testcase.get("id").getAsInt();JsonArray inputArr=testcase.getAsJsonArray("input");Map<String,Object> result=new LinkedHashMap<>();result.put("case",id);try{int[] nums=gson.fromJson(inputArr.get(0),int[].class);int output=solution.maxSubArray(nums);result.put("status","OK");result.put("output",output);}catch(Exception e){result.put("status","ERROR");result.put("error",e.getClass().getSimpleName()+": "+e.getMessage());}results.add(result);}Map<String,Object> response=new LinkedHashMap<>();response.put("results",results);response.put("meta",Map.of("timeMs",System.currentTimeMillis()));System.out.println("<<<JUDGE_OUTPUT_V1_BEGIN>>>");System.out.println(gson.toJson(response));System.out.println("<<<JUDGE_OUTPUT_V1_END>>>");}}`,
};

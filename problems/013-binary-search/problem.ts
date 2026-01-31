import type { Problem } from '../types';
import { starterCode as javaStarterCode, referenceSolution as javaReferenceSolution } from './java';

export const binarySearch: Problem = {
    problemId: 'binary-search',
    title: 'Binary Search',
    difficulty: 'easy',
    topics: ['array', 'binary-search'],
    description: `Given an array of integers \`nums\` which is sorted in ascending order, and an integer \`target\`, write a function to search \`target\` in \`nums\`. If \`target\` exists, then return its index. Otherwise, return \`-1\`.

You must write an algorithm with **O(log n)** runtime complexity.

**Example 1:**
\`\`\`
Input: nums = [-1,0,3,5,9,12], target = 9
Output: 4
Explanation: 9 exists in nums and its index is 4.
\`\`\`

**Example 2:**
\`\`\`
Input: nums = [-1,0,3,5,9,12], target = 2
Output: -1
Explanation: 2 does not exist in nums so return -1.
\`\`\``,
    constraints: ['1 <= nums.length <= 10^4', '-10^4 < nums[i], target < 10^4', 'All integers in nums are unique.', 'nums is sorted in ascending order.'],
    inputSpec: { kind: 'tuple', elements: [{ kind: 'array', of: { kind: 'int' } }, { kind: 'int' }] },
    outputSpec: { kind: 'int' },
    functionSignature: { name: 'search', params: [{ name: 'nums', type: 'int[]', typeSpec: { kind: 'array', of: { kind: 'int' } } }, { name: 'target', type: 'int', typeSpec: { kind: 'int' } }], returnType: 'int', returnTypeSpec: { kind: 'int' } },
    examples: [{ input: [[-1, 0, 3, 5, 9, 12], 9], output: 4 }, { input: [[-1, 0, 3, 5, 9, 12], 2], output: -1 }],
    tests: [
        { testId: 'visible-1', input: [[-1, 0, 3, 5, 9, 12], 9], expected: 4, comparator: { type: 'exact' }, visibility: 'visible', weight: 1 },
        { testId: 'visible-2', input: [[-1, 0, 3, 5, 9, 12], 2], expected: -1, comparator: { type: 'exact' }, visibility: 'visible', weight: 1 },
        { testId: 'hidden-1', input: [[5], 5], expected: 0, comparator: { type: 'exact' }, visibility: 'hidden', weight: 2, description: 'Single element found' },
        { testId: 'hidden-2', input: [[5], -5], expected: -1, comparator: { type: 'exact' }, visibility: 'hidden', weight: 2, description: 'Single element not found' },
        { testId: 'hidden-3', input: [[1, 2, 3, 4, 5], 1], expected: 0, comparator: { type: 'exact' }, visibility: 'hidden', weight: 1, description: 'First element' },
        { testId: 'hidden-4', input: [[1, 2, 3, 4, 5], 5], expected: 4, comparator: { type: 'exact' }, visibility: 'hidden', weight: 1, description: 'Last element' },
    ],
    starterCode: { java: javaStarterCode },
    referenceSolutions: { java: javaReferenceSolution },
    timeLimit: 2000, memoryLimit: 256,
    javaHarness: `import com.google.gson.*;import java.util.*;public class Main{public static void main(String[] args){Scanner sc=new Scanner(System.in);StringBuilder sb=new StringBuilder();while(sc.hasNextLine())sb.append(sc.nextLine());Gson gson=new Gson();JsonObject input=JsonParser.parseString(sb.toString()).getAsJsonObject();JsonArray testcases=input.getAsJsonArray("testcases");List<Map<String,Object>> results=new ArrayList<>();UserSolution solution=new UserSolution();for(JsonElement tc:testcases){JsonObject testcase=tc.getAsJsonObject();int id=testcase.get("id").getAsInt();JsonArray inputArr=testcase.getAsJsonArray("input");Map<String,Object> result=new LinkedHashMap<>();result.put("case",id);try{int[] nums=gson.fromJson(inputArr.get(0),int[].class);int target=inputArr.get(1).getAsInt();int output=solution.search(nums,target);result.put("status","OK");result.put("output",output);}catch(Exception e){result.put("status","ERROR");result.put("error",e.getClass().getSimpleName()+": "+e.getMessage());}results.add(result);}Map<String,Object> response=new LinkedHashMap<>();response.put("results",results);response.put("meta",Map.of("timeMs",System.currentTimeMillis()));System.out.println("<<<JUDGE_OUTPUT_V1_BEGIN>>>");System.out.println(gson.toJson(response));System.out.println("<<<JUDGE_OUTPUT_V1_END>>>");}}`,
};

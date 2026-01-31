import type { Problem } from '../types';
import { starterCode as javaStarterCode, referenceSolution as javaReferenceSolution } from './java';

export const productOfArrayExceptSelf: Problem = {
    problemId: 'product-of-array-except-self',
    title: 'Product of Array Except Self',
    difficulty: 'medium',
    topics: ['array', 'prefix-sum'],

    description: `Given an integer array \`nums\`, return an array \`answer\` such that \`answer[i]\` is equal to the product of all the elements of \`nums\` except \`nums[i]\`.

You must write an algorithm that runs in **O(n)** time and **without using the division operation**.

**Example 1:**
\`\`\`
Input: nums = [1,2,3,4]
Output: [24,12,8,6]
\`\`\`

**Example 2:**
\`\`\`
Input: nums = [-1,1,0,-3,3]
Output: [0,0,9,0,0]
\`\`\``,

    constraints: ['2 <= nums.length <= 10^5', '-30 <= nums[i] <= 30', 'Product of any prefix/suffix fits in 32-bit int'],
    inputSpec: { kind: 'tuple', elements: [{ kind: 'array', of: { kind: 'int' } }] },
    outputSpec: { kind: 'array', of: { kind: 'int' } },
    functionSignature: { name: 'productExceptSelf', params: [{ name: 'nums', type: 'int[]', typeSpec: { kind: 'array', of: { kind: 'int' } } }], returnType: 'int[]', returnTypeSpec: { kind: 'array', of: { kind: 'int' } } },
    examples: [{ input: [[1, 2, 3, 4]], output: [24, 12, 8, 6] }, { input: [[-1, 1, 0, -3, 3]], output: [0, 0, 9, 0, 0] }],
    tests: [
        { testId: 'visible-1', input: [[1, 2, 3, 4]], expected: [24, 12, 8, 6], comparator: { type: 'exact' }, visibility: 'visible', weight: 1 },
        { testId: 'visible-2', input: [[-1, 1, 0, -3, 3]], expected: [0, 0, 9, 0, 0], comparator: { type: 'exact' }, visibility: 'visible', weight: 1 },
        { testId: 'hidden-1', input: [[1, 1]], expected: [1, 1], comparator: { type: 'exact' }, visibility: 'hidden', weight: 2 },
        { testId: 'hidden-2', input: [[0, 0]], expected: [0, 0], comparator: { type: 'exact' }, visibility: 'hidden', weight: 2 },
        { testId: 'hidden-3', input: [[2, 3, 4, 5]], expected: [60, 40, 30, 24], comparator: { type: 'exact' }, visibility: 'hidden', weight: 1 },
        { testId: 'hidden-4', input: [[-1, -1, 1]], expected: [1, -1, -1], comparator: { type: 'exact' }, visibility: 'hidden', weight: 2 },
    ],
    starterCode: { java: javaStarterCode },
    referenceSolutions: { java: javaReferenceSolution },
    timeLimit: 2000, memoryLimit: 256,
    javaHarness: `import com.google.gson.*;import java.util.*;public class Main{public static void main(String[] args){Scanner sc=new Scanner(System.in);StringBuilder sb=new StringBuilder();while(sc.hasNextLine())sb.append(sc.nextLine());Gson gson=new Gson();JsonObject input=JsonParser.parseString(sb.toString()).getAsJsonObject();JsonArray testcases=input.getAsJsonArray("testcases");List<Map<String,Object>> results=new ArrayList<>();UserSolution solution=new UserSolution();for(JsonElement tc:testcases){JsonObject testcase=tc.getAsJsonObject();int id=testcase.get("id").getAsInt();JsonArray inputArr=testcase.getAsJsonArray("input");Map<String,Object> result=new LinkedHashMap<>();result.put("case",id);try{int[] nums=gson.fromJson(inputArr.get(0),int[].class);int[] output=solution.productExceptSelf(nums);result.put("status","OK");result.put("output",output);}catch(Exception e){result.put("status","ERROR");result.put("error",e.getClass().getSimpleName()+": "+e.getMessage());}results.add(result);}Map<String,Object> response=new LinkedHashMap<>();response.put("results",results);response.put("meta",Map.of("timeMs",System.currentTimeMillis()));System.out.println("<<<JUDGE_OUTPUT_V1_BEGIN>>>");System.out.println(gson.toJson(response));System.out.println("<<<JUDGE_OUTPUT_V1_END>>>");}}`,
};

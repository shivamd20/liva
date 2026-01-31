import type { Problem } from '../types';
import { starterCode as javaStarterCode, referenceSolution as javaReferenceSolution } from './java';

export const threeSum: Problem = {
    problemId: 'three-sum',
    title: '3Sum',
    difficulty: 'medium',
    topics: ['array', 'two-pointers', 'sorting'],

    description: `Given an integer array \`nums\`, return all the triplets \`[nums[i], nums[j], nums[k]]\` such that \`i != j\`, \`i != k\`, and \`j != k\`, and \`nums[i] + nums[j] + nums[k] == 0\`.

Notice that the solution set must not contain duplicate triplets.

**Example 1:**
\`\`\`
Input: nums = [-1,0,1,2,-1,-4]
Output: [[-1,-1,2],[-1,0,1]]
\`\`\`

**Example 2:**
\`\`\`
Input: nums = [0,1,1]
Output: []
\`\`\`

**Example 3:**
\`\`\`
Input: nums = [0,0,0]
Output: [[0,0,0]]
\`\`\``,

    constraints: ['3 <= nums.length <= 3000', '-10^5 <= nums[i] <= 10^5'],
    inputSpec: { kind: 'tuple', elements: [{ kind: 'array', of: { kind: 'int' } }] },
    outputSpec: { kind: 'array', of: { kind: 'array', of: { kind: 'int' } } },
    functionSignature: { name: 'threeSum', params: [{ name: 'nums', type: 'int[]', typeSpec: { kind: 'array', of: { kind: 'int' } } }], returnType: 'List<List<Integer>>', returnTypeSpec: { kind: 'array', of: { kind: 'array', of: { kind: 'int' } } } },
    examples: [{ input: [[-1, 0, 1, 2, -1, -4]], output: [[-1, -1, 2], [-1, 0, 1]] }],
    tests: [
        { testId: 'visible-1', input: [[-1, 0, 1, 2, -1, -4]], expected: [[-1, -1, 2], [-1, 0, 1]], comparator: { type: 'multiset' }, visibility: 'visible', weight: 1 },
        { testId: 'visible-2', input: [[0, 1, 1]], expected: [], comparator: { type: 'multiset' }, visibility: 'visible', weight: 1 },
        { testId: 'visible-3', input: [[0, 0, 0]], expected: [[0, 0, 0]], comparator: { type: 'multiset' }, visibility: 'visible', weight: 1 },
        { testId: 'hidden-1', input: [[1, 2, -3]], expected: [[-3, 1, 2]], comparator: { type: 'multiset' }, visibility: 'hidden', weight: 2 },
        { testId: 'hidden-2', input: [[0, 0, 0, 0]], expected: [[0, 0, 0]], comparator: { type: 'multiset' }, visibility: 'hidden', weight: 2, description: 'Only one unique triplet' },
        { testId: 'hidden-3', input: [[-2, 0, 1, 1, 2]], expected: [[-2, 0, 2], [-2, 1, 1]], comparator: { type: 'multiset' }, visibility: 'hidden', weight: 2 },
    ],
    starterCode: { java: javaStarterCode },
    referenceSolutions: { java: javaReferenceSolution },
    timeLimit: 2000, memoryLimit: 256,
    javaHarness: `import com.google.gson.*;import java.util.*;public class Main{public static void main(String[] args){Scanner sc=new Scanner(System.in);StringBuilder sb=new StringBuilder();while(sc.hasNextLine())sb.append(sc.nextLine());Gson gson=new Gson();JsonObject input=JsonParser.parseString(sb.toString()).getAsJsonObject();JsonArray testcases=input.getAsJsonArray("testcases");List<Map<String,Object>> results=new ArrayList<>();UserSolution solution=new UserSolution();for(JsonElement tc:testcases){JsonObject testcase=tc.getAsJsonObject();int id=testcase.get("id").getAsInt();JsonArray inputArr=testcase.getAsJsonArray("input");Map<String,Object> result=new LinkedHashMap<>();result.put("case",id);try{int[] nums=gson.fromJson(inputArr.get(0),int[].class);List<List<Integer>> output=solution.threeSum(nums);for(List<Integer> t:output)Collections.sort(t);output.sort((a,b)->{for(int i=0;i<Math.min(a.size(),b.size());i++){int cmp=a.get(i).compareTo(b.get(i));if(cmp!=0)return cmp;}return a.size()-b.size();});result.put("status","OK");result.put("output",output);}catch(Exception e){result.put("status","ERROR");result.put("error",e.getClass().getSimpleName()+": "+e.getMessage());}results.add(result);}Map<String,Object> response=new LinkedHashMap<>();response.put("results",results);response.put("meta",Map.of("timeMs",System.currentTimeMillis()));System.out.println("<<<JUDGE_OUTPUT_V1_BEGIN>>>");System.out.println(gson.toJson(response));System.out.println("<<<JUDGE_OUTPUT_V1_END>>>");}}`,
};

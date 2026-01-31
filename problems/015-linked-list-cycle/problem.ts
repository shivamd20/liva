import type { Problem } from '../types';
import { starterCode as javaStarterCode, referenceSolution as javaReferenceSolution } from './java';

export const linkedListCycle: Problem = {
    problemId: 'linked-list-cycle',
    title: 'Linked List Cycle',
    difficulty: 'easy',
    topics: ['linked-list', 'two-pointers', 'hash-table'],
    description: `Given \`head\`, the head of a linked list, determine if the linked list has a cycle in it.

There is a cycle if there is some node in the list that can be reached again by continuously following the \`next\` pointer.

Return \`true\` if there is a cycle, or \`false\` otherwise.

**Example 1:**
\`\`\`
Input: head = [3,2,0,-4], pos = 1
Output: true
Explanation: There is a cycle, where the tail connects to the 1st node (0-indexed).
\`\`\`

**Example 2:**
\`\`\`
Input: head = [1], pos = -1
Output: false
Explanation: No cycle.
\`\`\``,
    constraints: ['Number of nodes in list is in range [0, 10^4]', '-10^5 <= Node.val <= 10^5', 'pos is -1 or a valid index'],
    inputSpec: { kind: 'tuple', elements: [{ kind: 'array', of: { kind: 'int' } }, { kind: 'int' }] },
    outputSpec: { kind: 'boolean' },
    functionSignature: { name: 'hasCycle', params: [{ name: 'head', type: 'ListNode', typeSpec: { kind: 'array', of: { kind: 'int' } } }], returnType: 'boolean', returnTypeSpec: { kind: 'boolean' } },
    examples: [{ input: [[3, 2, 0, -4], 1], output: true }, { input: [[1], -1], output: false }],
    tests: [
        { testId: 'visible-1', input: [[3, 2, 0, -4], 1], expected: true, comparator: { type: 'exact' }, visibility: 'visible', weight: 1 },
        { testId: 'visible-2', input: [[1, 2], 0], expected: true, comparator: { type: 'exact' }, visibility: 'visible', weight: 1 },
        { testId: 'visible-3', input: [[1], -1], expected: false, comparator: { type: 'exact' }, visibility: 'visible', weight: 1 },
        { testId: 'hidden-1', input: [[], -1], expected: false, comparator: { type: 'exact' }, visibility: 'hidden', weight: 2, description: 'Empty list' },
        { testId: 'hidden-2', input: [[1, 2, 3, 4, 5], -1], expected: false, comparator: { type: 'exact' }, visibility: 'hidden', weight: 2, description: 'No cycle' },
        { testId: 'hidden-3', input: [[1, 2, 3, 4, 5], 2], expected: true, comparator: { type: 'exact' }, visibility: 'hidden', weight: 2, description: 'Cycle in middle' },
    ],
    starterCode: { java: javaStarterCode },
    referenceSolutions: { java: javaReferenceSolution },
    timeLimit: 2000, memoryLimit: 256,
    javaHarness: `import com.google.gson.*;import java.util.*;class ListNode{int val;ListNode next;ListNode(int x){val=x;next=null;}}public class Main{static ListNode buildListWithCycle(int[] arr,int pos){if(arr.length==0)return null;ListNode[] nodes=new ListNode[arr.length];for(int i=0;i<arr.length;i++)nodes[i]=new ListNode(arr[i]);for(int i=0;i<arr.length-1;i++)nodes[i].next=nodes[i+1];if(pos>=0&&pos<arr.length)nodes[arr.length-1].next=nodes[pos];return nodes[0];}public static void main(String[] args){Scanner sc=new Scanner(System.in);StringBuilder sb=new StringBuilder();while(sc.hasNextLine())sb.append(sc.nextLine());Gson gson=new Gson();JsonObject input=JsonParser.parseString(sb.toString()).getAsJsonObject();JsonArray testcases=input.getAsJsonArray("testcases");List<Map<String,Object>> results=new ArrayList<>();UserSolution solution=new UserSolution();for(JsonElement tc:testcases){JsonObject testcase=tc.getAsJsonObject();int id=testcase.get("id").getAsInt();JsonArray inputArr=testcase.getAsJsonArray("input");Map<String,Object> result=new LinkedHashMap<>();result.put("case",id);try{int[] arr=gson.fromJson(inputArr.get(0),int[].class);int pos=inputArr.get(1).getAsInt();ListNode head=buildListWithCycle(arr,pos);boolean output=solution.hasCycle(head);result.put("status","OK");result.put("output",output);}catch(Exception e){result.put("status","ERROR");result.put("error",e.getClass().getSimpleName()+": "+e.getMessage());}results.add(result);}Map<String,Object> response=new LinkedHashMap<>();response.put("results",results);response.put("meta",Map.of("timeMs",System.currentTimeMillis()));System.out.println("<<<JUDGE_OUTPUT_V1_BEGIN>>>");System.out.println(gson.toJson(response));System.out.println("<<<JUDGE_OUTPUT_V1_END>>>");}}`,
};

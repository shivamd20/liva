import type { Problem } from '../types';
import { starterCode as javaStarterCode, referenceSolution as javaReferenceSolution } from './java';

export const mergeTwoSortedLists: Problem = {
    problemId: 'merge-two-sorted-lists',
    title: 'Merge Two Sorted Lists',
    difficulty: 'easy',
    topics: ['linked-list', 'recursion'],
    description: `You are given the heads of two sorted linked lists \`list1\` and \`list2\`.

Merge the two lists into one **sorted** list. The list should be made by splicing together the nodes of the first two lists.

Return the *head of the merged linked list*.

**Example 1:**
\`\`\`
Input: list1 = [1,2,4], list2 = [1,3,4]
Output: [1,1,2,3,4,4]
\`\`\`

**Example 2:**
\`\`\`
Input: list1 = [], list2 = []
Output: []
\`\`\`

**Example 3:**
\`\`\`
Input: list1 = [], list2 = [0]
Output: [0]
\`\`\``,
    constraints: ['Number of nodes in both lists is in range [0, 50]', '-100 <= Node.val <= 100', 'Both lists are sorted in non-decreasing order'],
    inputSpec: { kind: 'tuple', elements: [{ kind: 'array', of: { kind: 'int' } }, { kind: 'array', of: { kind: 'int' } }] },
    outputSpec: { kind: 'array', of: { kind: 'int' } },
    functionSignature: { name: 'mergeTwoLists', params: [{ name: 'list1', type: 'ListNode', typeSpec: { kind: 'array', of: { kind: 'int' } } }, { name: 'list2', type: 'ListNode', typeSpec: { kind: 'array', of: { kind: 'int' } } }], returnType: 'ListNode', returnTypeSpec: { kind: 'array', of: { kind: 'int' } } },
    examples: [{ input: [[1, 2, 4], [1, 3, 4]], output: [1, 1, 2, 3, 4, 4] }, { input: [[], []], output: [] }],
    tests: [
        { testId: 'visible-1', input: [[1, 2, 4], [1, 3, 4]], expected: [1, 1, 2, 3, 4, 4], comparator: { type: 'exact' }, visibility: 'visible', weight: 1 },
        { testId: 'visible-2', input: [[], []], expected: [], comparator: { type: 'exact' }, visibility: 'visible', weight: 1 },
        { testId: 'visible-3', input: [[], [0]], expected: [0], comparator: { type: 'exact' }, visibility: 'visible', weight: 1 },
        { testId: 'hidden-1', input: [[1], [2]], expected: [1, 2], comparator: { type: 'exact' }, visibility: 'hidden', weight: 2 },
        { testId: 'hidden-2', input: [[5], [1, 2, 3]], expected: [1, 2, 3, 5], comparator: { type: 'exact' }, visibility: 'hidden', weight: 2 },
        { testId: 'hidden-3', input: [[1, 1, 1], [1, 1, 1]], expected: [1, 1, 1, 1, 1, 1], comparator: { type: 'exact' }, visibility: 'hidden', weight: 2 },
    ],
    starterCode: { java: javaStarterCode },
    referenceSolutions: { java: javaReferenceSolution },
    timeLimit: 2000, memoryLimit: 256,
    javaHarness: `import com.google.gson.*;import java.util.*;class ListNode{int val;ListNode next;ListNode(){}ListNode(int val){this.val=val;}ListNode(int val,ListNode next){this.val=val;this.next=next;}}public class Main{static ListNode buildList(int[] arr){ListNode dummy=new ListNode(0);ListNode curr=dummy;for(int v:arr){curr.next=new ListNode(v);curr=curr.next;}return dummy.next;}static int[] toArray(ListNode head){List<Integer> list=new ArrayList<>();while(head!=null){list.add(head.val);head=head.next;}return list.stream().mapToInt(Integer::intValue).toArray();}public static void main(String[] args){Scanner sc=new Scanner(System.in);StringBuilder sb=new StringBuilder();while(sc.hasNextLine())sb.append(sc.nextLine());Gson gson=new Gson();JsonObject input=JsonParser.parseString(sb.toString()).getAsJsonObject();JsonArray testcases=input.getAsJsonArray("testcases");List<Map<String,Object>> results=new ArrayList<>();UserSolution solution=new UserSolution();for(JsonElement tc:testcases){JsonObject testcase=tc.getAsJsonObject();int id=testcase.get("id").getAsInt();JsonArray inputArr=testcase.getAsJsonArray("input");Map<String,Object> result=new LinkedHashMap<>();result.put("case",id);try{int[] arr1=gson.fromJson(inputArr.get(0),int[].class);int[] arr2=gson.fromJson(inputArr.get(1),int[].class);ListNode l1=buildList(arr1);ListNode l2=buildList(arr2);ListNode merged=solution.mergeTwoLists(l1,l2);result.put("status","OK");result.put("output",toArray(merged));}catch(Exception e){result.put("status","ERROR");result.put("error",e.getClass().getSimpleName()+": "+e.getMessage());}results.add(result);}Map<String,Object> response=new LinkedHashMap<>();response.put("results",results);response.put("meta",Map.of("timeMs",System.currentTimeMillis()));System.out.println("<<<JUDGE_OUTPUT_V1_BEGIN>>>");System.out.println(gson.toJson(response));System.out.println("<<<JUDGE_OUTPUT_V1_END>>>");}}`,
};

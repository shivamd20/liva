
import { z } from 'zod';

// For streaming, we don't strictly enforce a single giant Output Schema.
// Instead we expect a specific NDJSON structure.
export const PROMPTS = {
  GENERATE_PROBLEM: (intent: string) => `# GENERATE_PROBLEM Prompt v1 - Protocol v1

Generate a complete coding problem definition based on the following intent: "${intent}"

## GLOBAL INVARIANTS (APPLY TO ALL PROMPTS)

* Output **MUST** be valid NDJSON
* **Exactly one JSON object per line**
* **No blank lines**
* **No trailing spaces or newlines**
* **No markdown, no code fences, no commentary**
* If **any line** is malformed JSON, **discard entire output**
* All objects must be **self-contained**
* **Strict line ordering is mandatory**

## Output Ordering (STRICT)

1. metadata (exactly once)
2. description (exactly once)
3. constraint (1 or more)
4. example (2 to 3)
5. test (5 to 7)

## Line Schemas

### 1. Metadata
{"type":"metadata","title":"...","difficulty":"Easy|Medium|Hard","topics":["..."]}

### 2. Description
* Must be **language-agnostic**
* Must NOT mention functions, classes, method names, or signatures
{"type":"description","content":"..."}

### 3. Constraint (repeatable)
* Human-readable
* Explicit guarantees required (non-null, bounds, ordering, etc.)
{"type":"constraint","content":"..."}

### 4. Example (repeatable)
* Must be consistent with visible test cases
{"type":"example","input":...,"output":...,"explanation":"..."}

### 5. Test Case (repeatable)
{"type":"test","testId":"1","input":...,"expected":...,"visibility":"visible|hidden"}

Rules:
* \`input\` is a JSON array of positional arguments
* \`testId\` must be a stringified integer
* Hidden tests **must include expected output**
* No randomized tests
* No tests outside constraints`,

  GENERATE_IMPLEMENTATION: (problem: any) => `# GENERATE_IMPLEMENTATION Prompt v1 - Protocol v1

Generate fully runnable Java code that compiles on Java 17+, uses Gson as the only external dependency, and executes user code against the following problem definition.

## PROBLEM DEFINITION:
${JSON.stringify(problem, null, 2)}

## GLOBAL INVARIANTS

* Output **MUST** be valid NDJSON
* **Exactly one JSON object per line**
* **No blank lines**
* **No trailing spaces or newlines**
* **No markdown, no code fences, no commentary**
* If **any line** is malformed JSON, **discard entire output**
* All objects must be **self-contained**
* **Strict line ordering is mandatory**

## Output Ordering (STRICT)

1. starterCode
2. referenceSolution
3. harness

## 1. Starter Code
{"type":"starterCode","content":"<FULL COMPILABLE Java CODE>"}
Rules:
* Must compile standalone
* Must define class \`UserSolution\`
* Imports allowed
* No helper classes

## 2. Reference Solution
{"type":"referenceSolution","content":"<FULL OPTIMIZED Java CODE>"}
Rules:
* Must define \`UserSolution\`
* No helper classes
* Optimized for asymptotic complexity
* No truncation

## 3. Harness (Main.java) [MANDATORY / SUPER REQUIRED]
* **THIS SECTION IS CRITICAL. YOU MUST GENERATE THE HARNESS.**
{"type":"harness","content":"<FULL Main.java CODE>"}

### HARNESS HARD RULES
* Java 17+
* Gson **must be explicitly imported**
* Reads **entire stdin** as JSON. 
* **DO NOT** use \`System.in.lines()\` (invalid symbol). 
* Use this boilerplate for reading stdin:
  \`Scanner scanner = new Scanner(System.in).useDelimiter("\\\\A");\`
  \`String jsonInput = scanner.hasNext() ? scanner.next() : "{}";\`
* Input format: {"testcases":[{"id":1,"input":[...]},...]}
* Input shape must be validated before execution
* Malformed input = **hard failure**
* Per-test execution
* Partial success allowed
* Capture stdout from user code
* Deterministic JSON field ordering

### REQUIRED OUTPUT FORMAT
The harness **MUST** emit JSON output followed by newline, wrapped in explicit sentinels. 
Output MUST be printed like this:

System.out.println("<<<JUDGE_OUTPUT_V1_BEGIN>>>");
System.out.println(gson.toJson(outputJson));
System.out.println("<<<JUDGE_OUTPUT_V1_END>>>");

#### Output JSON Schema (MANDATORY):
{
  "results": [
    {
      "id": number,
      "status": "OK" | "ERROR",
      "output": unknown, // The result of user solution (only if status is OK)
      "error": string,   // Error message (only if status is ERROR)
      "stacktrace": string (optional)
    }
  ],
  "meta": {
    "timeMs": number // Total execution time for all tests
  }
}

Rules:
* Nothing printed outside sentinels
* Include stack traces for runtime errors
* Compile errors reported verbosely
* **Gson Usage**: Use \`.add(String, JsonElement)\` for objects/arrays. **DO NOT** use \`.addProperty(String, JsonArray/JsonObject)\` (compilation error).`
};

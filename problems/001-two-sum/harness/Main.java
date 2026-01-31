import com.google.gson.*;
import java.util.*;

public class Main {
    public static void main(String[] args) {
        // Read all stdin
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
                // Parse inputs: int[] nums, int target
                int[] nums = gson.fromJson(inputArr.get(0), int[].class);
                int target = inputArr.get(1).getAsInt();
                
                // Call user's solution
                int[] output = solution.twoSum(nums, target);
                
                result.put("status", "OK");
                result.put("output", output);
            } catch (Exception e) {
                result.put("status", "ERROR");
                result.put("error", e.getClass().getSimpleName() + ": " + e.getMessage());
            }
            
            results.add(result);
        }
        
        // Build response
        Map<String, Object> response = new LinkedHashMap<>();
        response.put("results", results);
        response.put("meta", Map.of("timeMs", System.currentTimeMillis()));
        
        // Emit sentinel-delimited output
        System.out.println("<<<JUDGE_OUTPUT_V1_BEGIN>>>");
        System.out.println(gson.toJson(response));
        System.out.println("<<<JUDGE_OUTPUT_V1_END>>>");
    }
}

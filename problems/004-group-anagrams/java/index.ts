/**
 * Group Anagrams - Java Language Files
 */

/**
 * Starter code - What users see when they start the problem.
 */
export const starterCode = `import java.util.*;

class UserSolution {
    public List<List<String>> groupAnagrams(String[] strs) {
        // TODO: Implement your solution here
        // Group anagrams together. You can return the answer in any order.
        
        return new ArrayList<>();
    }
}`;

/**
 * Reference solution - O(n * k log k) using sorted string as key.
 */
export const referenceSolution = `import java.util.*;

class UserSolution {
    public List<List<String>> groupAnagrams(String[] strs) {
        Map<String, List<String>> map = new HashMap<>();
        
        for (String s : strs) {
            char[] chars = s.toCharArray();
            Arrays.sort(chars);
            String key = new String(chars);
            
            map.computeIfAbsent(key, k -> new ArrayList<>()).add(s);
        }
        
        return new ArrayList<>(map.values());
    }
}`;

/**
 * Alternative solution - O(n * k) using character count as key.
 */
export const countingSolution = `import java.util.*;

class UserSolution {
    public List<List<String>> groupAnagrams(String[] strs) {
        Map<String, List<String>> map = new HashMap<>();
        
        for (String s : strs) {
            int[] count = new int[26];
            for (char c : s.toCharArray()) {
                count[c - 'a']++;
            }
            
            StringBuilder sb = new StringBuilder();
            for (int i = 0; i < 26; i++) {
                sb.append('#').append(count[i]);
            }
            String key = sb.toString();
            
            map.computeIfAbsent(key, k -> new ArrayList<>()).add(s);
        }
        
        return new ArrayList<>(map.values());
    }
}`;

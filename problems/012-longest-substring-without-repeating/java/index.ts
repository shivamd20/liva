export const starterCode = `import java.util.*;
class UserSolution {
    public int lengthOfLongestSubstring(String s) {
        // TODO: Find the length of the longest substring without repeating characters
        return 0;
    }
}`;

export const referenceSolution = `import java.util.*;
class UserSolution {
    public int lengthOfLongestSubstring(String s) {
        Map<Character, Integer> lastSeen = new HashMap<>();
        int maxLen = 0, start = 0;
        for (int i = 0; i < s.length(); i++) {
            char c = s.charAt(i);
            if (lastSeen.containsKey(c) && lastSeen.get(c) >= start) {
                start = lastSeen.get(c) + 1;
            }
            lastSeen.put(c, i);
            maxLen = Math.max(maxLen, i - start + 1);
        }
        return maxLen;
    }
}`;

/**
 * Valid Anagram - Java Language Files
 * 
 * Contains starter code, reference solution, and other Java-specific content.
 */

/**
 * Starter code - This is what users see when they start the problem.
 * It should be runnable but return wrong answer.
 */
export const starterCode = `import java.util.*;

class UserSolution {
    public boolean isAnagram(String s, String t) {
        // TODO: Implement your solution here
        // Return true if t is an anagram of s, and false otherwise.
        // An anagram uses all the original letters exactly once.
        
        return false;
    }
}`;

/**
 * Reference solution - Optimal O(n) solution using character frequency count.
 * Used for verifying test cases are correct.
 */
export const referenceSolution = `import java.util.*;

class UserSolution {
    public boolean isAnagram(String s, String t) {
        if (s.length() != t.length()) {
            return false;
        }
        
        int[] count = new int[26];
        
        for (int i = 0; i < s.length(); i++) {
            count[s.charAt(i) - 'a']++;
            count[t.charAt(i) - 'a']--;
        }
        
        for (int c : count) {
            if (c != 0) {
                return false;
            }
        }
        
        return true;
    }
}`;

/**
 * Alternative solution using sorting - O(n log n).
 */
export const sortingSolution = `import java.util.*;

class UserSolution {
    public boolean isAnagram(String s, String t) {
        if (s.length() != t.length()) {
            return false;
        }
        
        char[] sArr = s.toCharArray();
        char[] tArr = t.toCharArray();
        Arrays.sort(sArr);
        Arrays.sort(tArr);
        
        return Arrays.equals(sArr, tArr);
    }
}`;

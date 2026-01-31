/**
 * Valid Palindrome - Java Language Files
 */

export const starterCode = `import java.util.*;

class UserSolution {
    public boolean isPalindrome(String s) {
        // TODO: Implement your solution here
        // Return true if the string is a palindrome (ignoring non-alphanumeric, case-insensitive)
        
        return false;
    }
}`;

export const referenceSolution = `import java.util.*;

class UserSolution {
    public boolean isPalindrome(String s) {
        int left = 0, right = s.length() - 1;
        
        while (left < right) {
            while (left < right && !Character.isLetterOrDigit(s.charAt(left))) {
                left++;
            }
            while (left < right && !Character.isLetterOrDigit(s.charAt(right))) {
                right--;
            }
            if (Character.toLowerCase(s.charAt(left)) != Character.toLowerCase(s.charAt(right))) {
                return false;
            }
            left++;
            right--;
        }
        return true;
    }
}`;

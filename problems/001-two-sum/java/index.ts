/**
 * Two Sum - Java Language Files
 * 
 * Contains starter code, reference solution, and other Java-specific content.
 */

/**
 * Starter code - This is what users see when they start the problem.
 * It should be runnable but return wrong answer.
 */
export const starterCode = `import java.util.*;

class UserSolution {
    public int[] twoSum(int[] nums, int target) {
        // TODO: Implement your solution here
        // Given an array of integers nums and an integer target,
        // return indices of the two numbers such that they add up to target.
        
        return new int[] { 0, 0 };
    }
}`;

/**
 * Reference solution - Optimal O(n) solution using hash map.
 * Used for verifying test cases are correct.
 */
export const referenceSolution = `import java.util.*;

class UserSolution {
    public int[] twoSum(int[] nums, int target) {
        Map<Integer, Integer> map = new HashMap<>();
        for (int i = 0; i < nums.length; i++) {
            int complement = target - nums[i];
            if (map.containsKey(complement)) {
                return new int[] { map.get(complement), i };
            }
            map.put(nums[i], i);
        }
        throw new IllegalArgumentException("No solution found");
    }
}`;

/**
 * Alternative brute force solution - O(n²) but still correct.
 */
export const bruteForceSolution = `import java.util.*;

class UserSolution {
    public int[] twoSum(int[] nums, int target) {
        for (int i = 0; i < nums.length; i++) {
            for (int j = i + 1; j < nums.length; j++) {
                if (nums[i] + nums[j] == target) {
                    return new int[] { i, j };
                }
            }
        }
        throw new IllegalArgumentException("No solution found");
    }
}`;

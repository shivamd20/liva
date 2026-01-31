/**
 * Contains Duplicate - Java Language Files
 */

/**
 * Starter code - What users see when they start the problem.
 */
export const starterCode = `import java.util.*;

class UserSolution {
    public boolean containsDuplicate(int[] nums) {
        // TODO: Implement your solution here
        // Return true if any value appears at least twice in the array,
        // and return false if every element is distinct.
        
        return false;
    }
}`;

/**
 * Reference solution - O(n) using HashSet.
 */
export const referenceSolution = `import java.util.*;

class UserSolution {
    public boolean containsDuplicate(int[] nums) {
        Set<Integer> seen = new HashSet<>();
        for (int num : nums) {
            if (!seen.add(num)) {
                return true;
            }
        }
        return false;
    }
}`;

/**
 * Alternative solution - O(n log n) using sorting.
 */
export const sortingSolution = `import java.util.*;

class UserSolution {
    public boolean containsDuplicate(int[] nums) {
        Arrays.sort(nums);
        for (int i = 1; i < nums.length; i++) {
            if (nums[i] == nums[i - 1]) {
                return true;
            }
        }
        return false;
    }
}`;

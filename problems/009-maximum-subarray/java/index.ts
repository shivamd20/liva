/**
 * Maximum Subarray - Java Language Files
 */

export const starterCode = `import java.util.*;

class UserSolution {
    public int maxSubArray(int[] nums) {
        // TODO: Find the contiguous subarray with the largest sum
        // Return that sum
        
        return 0;
    }
}`;

export const referenceSolution = `import java.util.*;

class UserSolution {
    public int maxSubArray(int[] nums) {
        // Kadane's algorithm
        int maxSum = nums[0];
        int currentSum = nums[0];
        
        for (int i = 1; i < nums.length; i++) {
            currentSum = Math.max(nums[i], currentSum + nums[i]);
            maxSum = Math.max(maxSum, currentSum);
        }
        
        return maxSum;
    }
}`;

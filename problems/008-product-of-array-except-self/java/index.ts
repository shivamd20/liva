/**
 * Product of Array Except Self - Java Language Files
 */

export const starterCode = `import java.util.*;

class UserSolution {
    public int[] productExceptSelf(int[] nums) {
        // TODO: Implement without using division
        // Return an array where answer[i] = product of all elements except nums[i]
        
        return new int[nums.length];
    }
}`;

export const referenceSolution = `import java.util.*;

class UserSolution {
    public int[] productExceptSelf(int[] nums) {
        int n = nums.length;
        int[] answer = new int[n];
        
        // Left pass - answer[i] = product of all elements to the left
        answer[0] = 1;
        for (int i = 1; i < n; i++) {
            answer[i] = answer[i - 1] * nums[i - 1];
        }
        
        // Right pass - multiply by product of all elements to the right
        int rightProduct = 1;
        for (int i = n - 1; i >= 0; i--) {
            answer[i] *= rightProduct;
            rightProduct *= nums[i];
        }
        
        return answer;
    }
}`;

export const starterCode = `import java.util.*;
class UserSolution {
    public int search(int[] nums, int target) {
        // TODO: Binary search for target, return index or -1 if not found
        return -1;
    }
}`;

export const referenceSolution = `import java.util.*;
class UserSolution {
    public int search(int[] nums, int target) {
        int left = 0, right = nums.length - 1;
        while (left <= right) {
            int mid = left + (right - left) / 2;
            if (nums[mid] == target) return mid;
            else if (nums[mid] < target) left = mid + 1;
            else right = mid - 1;
        }
        return -1;
    }
}`;

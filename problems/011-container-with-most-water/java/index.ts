export const starterCode = `import java.util.*;
class UserSolution {
    public int maxArea(int[] height) {
        // TODO: Find two lines that form a container with the most water
        return 0;
    }
}`;

export const referenceSolution = `import java.util.*;
class UserSolution {
    public int maxArea(int[] height) {
        int maxArea = 0;
        int left = 0, right = height.length - 1;
        while (left < right) {
            int area = Math.min(height[left], height[right]) * (right - left);
            maxArea = Math.max(maxArea, area);
            if (height[left] < height[right]) left++;
            else right--;
        }
        return maxArea;
    }
}`;

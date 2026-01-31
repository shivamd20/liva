/**
 * Best Time to Buy and Sell Stock - Java Language Files
 */

export const starterCode = `import java.util.*;

class UserSolution {
    public int maxProfit(int[] prices) {
        // TODO: Implement your solution here
        // Return the maximum profit you can achieve from this transaction.
        // If you cannot achieve any profit, return 0.
        
        return 0;
    }
}`;

export const referenceSolution = `import java.util.*;

class UserSolution {
    public int maxProfit(int[] prices) {
        int minPrice = Integer.MAX_VALUE;
        int maxProfit = 0;
        
        for (int price : prices) {
            if (price < minPrice) {
                minPrice = price;
            } else if (price - minPrice > maxProfit) {
                maxProfit = price - minPrice;
            }
        }
        
        return maxProfit;
    }
}`;

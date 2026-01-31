/**
 * Top K Frequent Elements - Java Language Files
 */

/**
 * Starter code - What users see when they start the problem.
 */
export const starterCode = `import java.util.*;

class UserSolution {
    public int[] topKFrequent(int[] nums, int k) {
        // TODO: Implement your solution here
        // Return the k most frequent elements.
        // You may return the answer in any order.
        
        return new int[0];
    }
}`;

/**
 * Reference solution - O(n log k) using min heap.
 */
export const referenceSolution = `import java.util.*;

class UserSolution {
    public int[] topKFrequent(int[] nums, int k) {
        // Count frequency
        Map<Integer, Integer> count = new HashMap<>();
        for (int num : nums) {
            count.put(num, count.getOrDefault(num, 0) + 1);
        }
        
        // Min heap based on frequency
        PriorityQueue<Integer> heap = new PriorityQueue<>(
            (a, b) -> count.get(a) - count.get(b)
        );
        
        for (int num : count.keySet()) {
            heap.add(num);
            if (heap.size() > k) {
                heap.poll();
            }
        }
        
        int[] result = new int[k];
        for (int i = k - 1; i >= 0; i--) {
            result[i] = heap.poll();
        }
        return result;
    }
}`;

/**
 * Alternative solution - O(n) using bucket sort.
 */
export const bucketSortSolution = `import java.util.*;

class UserSolution {
    public int[] topKFrequent(int[] nums, int k) {
        // Count frequency
        Map<Integer, Integer> count = new HashMap<>();
        for (int num : nums) {
            count.put(num, count.getOrDefault(num, 0) + 1);
        }
        
        // Bucket sort - index is frequency
        @SuppressWarnings("unchecked")
        List<Integer>[] buckets = new List[nums.length + 1];
        for (int i = 0; i < buckets.length; i++) {
            buckets[i] = new ArrayList<>();
        }
        
        for (Map.Entry<Integer, Integer> entry : count.entrySet()) {
            buckets[entry.getValue()].add(entry.getKey());
        }
        
        // Collect top k from highest frequency buckets
        int[] result = new int[k];
        int idx = 0;
        for (int i = buckets.length - 1; i >= 0 && idx < k; i--) {
            for (int num : buckets[i]) {
                result[idx++] = num;
                if (idx == k) break;
            }
        }
        return result;
    }
}`;

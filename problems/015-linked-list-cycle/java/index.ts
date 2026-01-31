export const starterCode = `import java.util.*;

// ListNode is provided by the system
class UserSolution {
    public boolean hasCycle(ListNode head) {
        // TODO: Return true if there is a cycle in the linked list
        return false;
    }
}`;

export const referenceSolution = `import java.util.*;

class UserSolution {
    public boolean hasCycle(ListNode head) {
        if (head == null || head.next == null) return false;
        
        ListNode slow = head, fast = head;
        while (fast != null && fast.next != null) {
            slow = slow.next;
            fast = fast.next.next;
            if (slow == fast) return true;
        }
        return false;
    }
}`;

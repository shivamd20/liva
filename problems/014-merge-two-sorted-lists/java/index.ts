export const starterCode = `import java.util.*;

// ListNode is provided by the system - DO NOT redefine it
// class ListNode { int val; ListNode next; ListNode() {} ListNode(int val) { this.val = val; } ... }

class UserSolution {
    public ListNode mergeTwoLists(ListNode list1, ListNode list2) {
        // TODO: Merge two sorted linked lists and return the merged list
        return null;
    }
}`;

export const referenceSolution = `import java.util.*;

class UserSolution {
    public ListNode mergeTwoLists(ListNode list1, ListNode list2) {
        ListNode dummy = new ListNode(0);
        ListNode curr = dummy;
        
        while (list1 != null && list2 != null) {
            if (list1.val <= list2.val) {
                curr.next = list1;
                list1 = list1.next;
            } else {
                curr.next = list2;
                list2 = list2.next;
            }
            curr = curr.next;
        }
        
        curr.next = (list1 != null) ? list1 : list2;
        return dummy.next;
    }
}`;

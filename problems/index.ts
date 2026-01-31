/**
 * Static Problem Bank Index
 * 
 * This module exports all available problems for the code practice system.
 * Problems are statically defined and validated at compile time.
 */

import type { Problem } from './types';
export type { Problem, TestCase, Example, TypeSpec, ComparatorSpec, FunctionSignature } from './types';

// Import problems from individual directories
import { twoSum } from './001-two-sum/problem';
import { validAnagram } from './002-valid-anagram/problem';
import { containsDuplicate } from './003-contains-duplicate/problem';
import { groupAnagrams } from './004-group-anagrams/problem';
import { topKFrequentElements } from './005-top-k-frequent-elements/problem';
import { validPalindrome } from './006-valid-palindrome/problem';
import { bestTimeToBuyAndSellStock } from './007-best-time-to-buy-and-sell-stock/problem';
import { productOfArrayExceptSelf } from './008-product-of-array-except-self/problem';
import { maximumSubarray } from './009-maximum-subarray/problem';
import { threeSum } from './010-three-sum/problem';
import { containerWithMostWater } from './011-container-with-most-water/problem';
import { longestSubstringWithoutRepeating } from './012-longest-substring-without-repeating/problem';
import { binarySearch } from './013-binary-search/problem';
import { mergeTwoSortedLists } from './014-merge-two-sorted-lists/problem';
import { linkedListCycle } from './015-linked-list-cycle/problem';

// Legacy imports (will be migrated to new structure)
import { addTwoNumbers } from './add-two-numbers';
import { maximumDepthBinaryTree } from './maximum-depth-binary-tree';
import { validParentheses } from './valid-parentheses';
import { reverseLinkedList } from './reverse-linked-list';

// Problem registry
export const problems: Record<string, Problem> = {
  'two-sum': twoSum,
  'valid-anagram': validAnagram,
  'contains-duplicate': containsDuplicate,
  'group-anagrams': groupAnagrams,
  'top-k-frequent-elements': topKFrequentElements,
  'valid-palindrome': validPalindrome,
  'best-time-to-buy-and-sell-stock': bestTimeToBuyAndSellStock,
  'product-of-array-except-self': productOfArrayExceptSelf,
  'maximum-subarray': maximumSubarray,
  'three-sum': threeSum,
  'container-with-most-water': containerWithMostWater,
  'longest-substring-without-repeating': longestSubstringWithoutRepeating,
  'binary-search': binarySearch,
  'merge-two-sorted-lists': mergeTwoSortedLists,
  'linked-list-cycle': linkedListCycle,
  'add-two-numbers': addTwoNumbers,
  'maximum-depth-binary-tree': maximumDepthBinaryTree,
  'valid-parentheses': validParentheses,
  'reverse-linked-list': reverseLinkedList,
};

// Helper functions
export function getProblem(id: string): Problem | undefined {
  return problems[id];
}

export function listProblems(): Problem[] {
  return Object.values(problems);
}

export function listProblemsByDifficulty(difficulty: 'easy' | 'medium' | 'hard'): Problem[] {
  return Object.values(problems).filter(p => p.difficulty === difficulty);
}

export function listProblemsByTopic(topic: string): Problem[] {
  return Object.values(problems).filter(p => p.topics.includes(topic));
}

// Export individual problems for direct import
export {
  twoSum,
  validAnagram,
  containsDuplicate,
  groupAnagrams,
  topKFrequentElements,
  validPalindrome,
  bestTimeToBuyAndSellStock,
  productOfArrayExceptSelf,
  maximumSubarray,
  threeSum,
  containerWithMostWater,
  longestSubstringWithoutRepeating,
  binarySearch,
  mergeTwoSortedLists,
  linkedListCycle,
  addTwoNumbers,
  maximumDepthBinaryTree,
  validParentheses,
  reverseLinkedList,
};

// Problem count
export const problemCount = Object.keys(problems).length;

// Logging helper
export function logProblemStats(): void {
  const byDifficulty = {
    easy: listProblemsByDifficulty('easy').length,
    medium: listProblemsByDifficulty('medium').length,
    hard: listProblemsByDifficulty('hard').length,
  };

  console.log(`[PROBLEMS] Total: ${problemCount}`);
  console.log(`[PROBLEMS] By difficulty: Easy=${byDifficulty.easy}, Medium=${byDifficulty.medium}, Hard=${byDifficulty.hard}`);
}

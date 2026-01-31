import type { Problem } from '../types';
import { starterCode as javaStarterCode, referenceSolution as javaReferenceSolution } from './java';
import { javaHarness } from './harness/java';
import tests from './tests.json';

/**
 * Two Sum - LeetCode Problem #1
 * 
 * The classic interview problem. Given an array and a target,
 * find two numbers that add up to the target.
 * 
 * Difficulty: Easy
 * Topics: Array, Hash Table
 */
export const twoSum: Problem = {
    problemId: 'two-sum',
    title: 'Two Sum',
    difficulty: 'easy',
    topics: ['array', 'hash-table'],

    description: `Given an array of integers \`nums\` and an integer \`target\`, return *indices of the two numbers such that they add up to \`target\`*.

You may assume that each input would have **exactly one solution**, and you may not use the same element twice.

You can return the answer in any order.

**Example 1:**
\`\`\`
Input: nums = [2,7,11,15], target = 9
Output: [0,1]
Explanation: Because nums[0] + nums[1] == 9, we return [0, 1].
\`\`\`

**Example 2:**
\`\`\`
Input: nums = [3,2,4], target = 6
Output: [1,2]
\`\`\`

**Example 3:**
\`\`\`
Input: nums = [3,3], target = 6
Output: [0,1]
\`\`\``,

    constraints: [
        '2 <= nums.length <= 10^4',
        '-10^9 <= nums[i] <= 10^9',
        '-10^9 <= target <= 10^9',
        'Only one valid answer exists.',
    ],

    inputSpec: {
        kind: 'tuple',
        elements: [
            { kind: 'array', of: { kind: 'int' } },
            { kind: 'int' },
        ],
    },

    outputSpec: {
        kind: 'array',
        of: { kind: 'int' },
    },

    examples: [
        {
            input: [[2, 7, 11, 15], 9],
            output: [0, 1],
            explanation: 'Because nums[0] + nums[1] == 9, we return [0, 1].',
        },
        {
            input: [[3, 2, 4], 6],
            output: [1, 2],
        },
        {
            input: [[3, 3], 6],
            output: [0, 1],
        },
    ],

    // Imported content for seeding
    tests: tests as any, // Cast because JSON import might be strict
    starterCode: {
        java: javaStarterCode,
    },
    referenceSolutions: {
        java: javaReferenceSolution,
    },

    // Legacy support via variable (mapped to file below)
    javaHarness: javaHarness,

    // NEW: Modular file references
    files: {
        tests: 'tests.json',
        starterCode: {
            java: 'starter/java.java' // Implicit path
        },
        referenceSolutions: {
            java: 'reference/java.java' // Implicit path
        },
        harness: {
            java: 'harness/java.java'
        }
    },

    timeLimit: 2000,
    memoryLimit: 256,
};

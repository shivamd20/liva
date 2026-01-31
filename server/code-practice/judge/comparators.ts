/**
 * Comparators
 * 
 * Functions to compare actual output with expected output
 * based on the ComparatorSpec defined for each test case.
 */

import type { ComparatorSpec } from '../types';

/**
 * Compare actual output with expected output using the specified comparator.
 * 
 * @param actual - The actual output from user's code
 * @param expected - The expected output from test case
 * @param comparator - How to compare the values
 * @returns true if outputs match according to comparator
 */
export function compare(
  actual: unknown,
  expected: unknown,
  comparator: ComparatorSpec
): boolean {
  switch (comparator.type) {
    case 'exact':
      return compareExact(actual, expected);
    
    case 'unorderedArray':
      return compareUnorderedArray(actual, expected);
    
    case 'set':
      return compareSet(actual, expected);
    
    case 'multiset':
      return compareMultiset(actual, expected);
    
    case 'numeric':
      return compareNumeric(actual, expected, comparator.tolerance);
    
    case 'floatArray':
      return compareFloatArray(actual, expected, comparator.tolerance);
    
    default:
      // Unknown comparator type - fall back to exact
      console.warn(`Unknown comparator type, falling back to exact`);
      return compareExact(actual, expected);
  }
}

/**
 * Exact comparison using deep equality.
 * Handles primitives, arrays, and nested objects.
 */
function compareExact(actual: unknown, expected: unknown): boolean {
  // Handle null/undefined
  if (actual === null && expected === null) return true;
  if (actual === undefined && expected === undefined) return true;
  if (actual === null || expected === null) return false;
  if (actual === undefined || expected === undefined) return false;

  // Handle primitives
  if (typeof actual !== typeof expected) return false;
  if (typeof actual !== 'object') {
    return actual === expected;
  }

  // Handle arrays
  if (Array.isArray(actual) && Array.isArray(expected)) {
    if (actual.length !== expected.length) return false;
    for (let i = 0; i < actual.length; i++) {
      if (!compareExact(actual[i], expected[i])) return false;
    }
    return true;
  }

  // Handle objects
  if (Array.isArray(actual) !== Array.isArray(expected)) return false;
  
  const actualObj = actual as Record<string, unknown>;
  const expectedObj = expected as Record<string, unknown>;
  const actualKeys = Object.keys(actualObj);
  const expectedKeys = Object.keys(expectedObj);
  
  if (actualKeys.length !== expectedKeys.length) return false;
  
  for (const key of actualKeys) {
    if (!compareExact(actualObj[key], expectedObj[key])) return false;
  }
  
  return true;
}

/**
 * Compare arrays ignoring order.
 * Elements must match but can be in any order.
 */
function compareUnorderedArray(actual: unknown, expected: unknown): boolean {
  if (!Array.isArray(actual) || !Array.isArray(expected)) {
    return compareExact(actual, expected);
  }

  if (actual.length !== expected.length) return false;

  // Sort both arrays and compare
  const sortedActual = [...actual].sort(compareForSort);
  const sortedExpected = [...expected].sort(compareForSort);

  return compareExact(sortedActual, sortedExpected);
}

/**
 * Compare as sets (unique elements, order doesn't matter).
 */
function compareSet(actual: unknown, expected: unknown): boolean {
  if (!Array.isArray(actual) || !Array.isArray(expected)) {
    return compareExact(actual, expected);
  }

  // Convert to sets using JSON serialization for complex elements
  const actualSet = new Set(actual.map(x => JSON.stringify(x)));
  const expectedSet = new Set(expected.map(x => JSON.stringify(x)));

  if (actualSet.size !== expectedSet.size) return false;

  for (const item of actualSet) {
    if (!expectedSet.has(item)) return false;
  }

  return true;
}

/**
 * Compare as multisets (allow duplicates, order doesn't matter).
 * Same as unorderedArray but with explicit semantics.
 */
function compareMultiset(actual: unknown, expected: unknown): boolean {
  return compareUnorderedArray(actual, expected);
}

/**
 * Compare numbers with tolerance.
 */
function compareNumeric(actual: unknown, expected: unknown, tolerance: number): boolean {
  if (typeof actual !== 'number' || typeof expected !== 'number') {
    return compareExact(actual, expected);
  }

  return Math.abs(actual - expected) <= tolerance;
}

/**
 * Compare arrays of floats with element-wise tolerance.
 */
function compareFloatArray(actual: unknown, expected: unknown, tolerance: number): boolean {
  if (!Array.isArray(actual) || !Array.isArray(expected)) {
    return compareExact(actual, expected);
  }

  if (actual.length !== expected.length) return false;

  for (let i = 0; i < actual.length; i++) {
    if (!compareNumeric(actual[i], expected[i], tolerance)) {
      return false;
    }
  }

  return true;
}

/**
 * Comparison function for sorting mixed arrays.
 * Converts elements to strings for consistent ordering.
 */
function compareForSort(a: unknown, b: unknown): number {
  const strA = JSON.stringify(a);
  const strB = JSON.stringify(b);
  return strA.localeCompare(strB);
}

/**
 * Normalize output for display purposes.
 * Converts to a consistent string representation.
 */
export function normalizeOutput(value: unknown): string {
  if (value === null) return 'null';
  if (value === undefined) return 'undefined';
  if (typeof value === 'string') return value;
  return JSON.stringify(value);
}

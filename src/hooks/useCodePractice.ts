/**
 * Code Practice Hooks
 * 
 * React Query hooks for the code practice system.
 */

import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import { trpcClient } from '../trpcClient';

// ============ Problem Queries ============

/**
 * Fetch list of problems with optional filtering
 */
export function useProblems(filters?: { difficulty?: 'easy' | 'medium' | 'hard'; topic?: string }) {
  return useQuery({
    queryKey: ['codePractice', 'problems', filters],
    queryFn: () => trpcClient.codePractice.listProblems.query(filters),
    staleTime: 5 * 60 * 1000, // 5 minutes
  });
}

/**
 * Fetch a single problem by ID
 */
export function useProblem(problemId: string | undefined) {
  return useQuery({
    queryKey: ['codePractice', 'problem', problemId],
    queryFn: () => trpcClient.codePractice.getProblem.query({ problemId: problemId! }),
    enabled: !!problemId,
    staleTime: 10 * 60 * 1000, // 10 minutes
  });
}

// ============ Code Execution ============

/**
 * Run code against visible tests only (quick test)
 */
export function useRunCode() {
  return useMutation({
    mutationFn: (input: { problemId: string; code: string; language: 'java' | 'javascript' | 'typescript' | 'python' }) =>
      trpcClient.codePractice.runCode.mutate(input),
  });
}

/**
 * Submit code for full evaluation (all tests)
 */
export function useSubmitCode() {
  const queryClient = useQueryClient();
  
  return useMutation({
    mutationFn: (input: { problemId: string; code: string; language: 'java' | 'javascript' | 'typescript' | 'python' }) =>
      trpcClient.codePractice.submitCode.mutate(input),
    onSuccess: (_, variables) => {
      // Invalidate related queries after submission
      queryClient.invalidateQueries({ queryKey: ['codePractice', 'solvedProblems'] });
      queryClient.invalidateQueries({ queryKey: ['codePractice', 'stats'] });
      queryClient.invalidateQueries({ queryKey: ['codePractice', 'submissions', variables.problemId] });
    },
  });
}

// ============ Draft Management ============

/**
 * Get saved draft for a problem
 */
export function useDraft(problemId: string | undefined, language: 'java' | 'javascript' | 'typescript' | 'python') {
  return useQuery({
    queryKey: ['codePractice', 'draft', problemId, language],
    queryFn: () => trpcClient.codePractice.getDraft.query({ problemId: problemId!, language }),
    enabled: !!problemId,
    staleTime: 0, // Always refetch to get latest draft
  });
}

/**
 * Save a code draft (auto-save)
 */
export function useSaveDraft() {
  const queryClient = useQueryClient();
  
  return useMutation({
    mutationFn: (input: { problemId: string; language: 'java' | 'javascript' | 'typescript' | 'python'; code: string }) =>
      trpcClient.codePractice.saveDraft.mutate(input),
    onSuccess: (_, variables) => {
      // Update the draft in cache
      queryClient.setQueryData(
        ['codePractice', 'draft', variables.problemId, variables.language],
        { code: variables.code }
      );
    },
  });
}

/**
 * Delete a draft
 */
export function useDeleteDraft() {
  const queryClient = useQueryClient();
  
  return useMutation({
    mutationFn: (input: { problemId: string; language: 'java' | 'javascript' | 'typescript' | 'python' }) =>
      trpcClient.codePractice.deleteDraft.mutate(input),
    onSuccess: (_, variables) => {
      queryClient.setQueryData(
        ['codePractice', 'draft', variables.problemId, variables.language],
        { code: null }
      );
    },
  });
}

// ============ Progress & Stats ============

/**
 * Get submission history for a problem
 */
export function useSubmissions(problemId: string | undefined, limit?: number) {
  return useQuery({
    queryKey: ['codePractice', 'submissions', problemId, limit],
    queryFn: () => trpcClient.codePractice.getSubmissions.query({ problemId: problemId!, limit }),
    enabled: !!problemId,
  });
}

/**
 * Get list of solved problem IDs
 */
export function useSolvedProblems() {
  return useQuery({
    queryKey: ['codePractice', 'solvedProblems'],
    queryFn: () => trpcClient.codePractice.getSolvedProblems.query(),
    staleTime: 60 * 1000, // 1 minute
  });
}

/**
 * Get user stats
 */
export function useUserStats() {
  return useQuery({
    queryKey: ['codePractice', 'stats'],
    queryFn: () => trpcClient.codePractice.getStats.query(),
    staleTime: 60 * 1000, // 1 minute
  });
}

// ============ Types ============

export type Problem = Awaited<ReturnType<typeof trpcClient.codePractice.getProblem.query>>;
export type ProblemSummary = Awaited<ReturnType<typeof trpcClient.codePractice.listProblems.query>>[number];
export type ExecutionResult = Awaited<ReturnType<typeof trpcClient.codePractice.runCode.mutate>>;
export type Submission = Awaited<ReturnType<typeof trpcClient.codePractice.getSubmissions.query>>['submissions'][number];

import { useQuery, useMutation, useQueryClient, useInfiniteQuery } from '@tanstack/react-query';
import { boards } from '../boardsConfig';
import { Board } from '../types';
import { useSession } from '../lib/auth-client';
import { ListBoardsOptions, BoardIndexEntry } from '../boards';

const BOARDS_QUERY_KEY = ['boards'];
const BOARDS_LIST_KEY = ['boards-list'];

/**
 * Options for useBoards hook
 */
export interface UseBoardsOptions {
  search?: string;
  filter?: 'all' | 'owned' | 'shared';
  visibility?: 'public' | 'private' | 'all';
  sortBy?: 'lastAccessed' | 'lastUpdated' | 'alphabetical' | 'created';
  sortOrder?: 'asc' | 'desc';
}

/**
 * Hook for fetching paginated boards from user's index
 * Uses infinite query for "load more" pagination
 */
export function useBoardsList(options: UseBoardsOptions = {}) {
  const { data: session } = useSession();
  const pageSize = 10;

  return useInfiniteQuery({
    queryKey: [...BOARDS_LIST_KEY, options],
    queryFn: async ({ pageParam }) => {
      return boards.list({
        search: options.search,
        filter: options.filter,
        visibility: options.visibility,
        sortBy: options.sortBy,
        sortOrder: options.sortOrder,
        limit: pageSize,
        cursor: pageParam as string | undefined,
      });
    },
    initialPageParam: undefined as string | undefined,
    getNextPageParam: (lastPage) => lastPage.nextCursor,
    enabled: !!session?.user,
  });
}

/**
 * @deprecated Use useBoardsList for paginated results
 * Legacy hook that fetches all boards (for backward compatibility)
 */
export function useBoards() {
  const { data: session } = useSession();
  return useQuery({
    queryKey: BOARDS_QUERY_KEY,
    queryFn: () => boards.getAll(),
    enabled: !!session?.user,
    refetchOnMount: 'always'
  });
}

export function useBoard(id: string | undefined) {
  const { data: session } = useSession();
  return useQuery({
    queryKey: ['board', id],
    queryFn: () => id ? boards.getById(id) : null,
    enabled: !!id && !!session?.user
  });
}

export function useCreateBoard(options?: {
  onSuccess?: (data: Board) => void;
  onError?: (error: Error) => void;
}) {
  const queryClient = useQueryClient();

  return useMutation({
    mutationFn: (params: { title?: string, id?: string, expiresInHours?: number, templateId?: string }) => boards.create(params.title, params.id, params.expiresInHours, params.templateId),
    onSuccess: (newBoard) => {
      queryClient.setQueryData(['board', newBoard.id], newBoard);
      queryClient.invalidateQueries({ queryKey: BOARDS_QUERY_KEY });
      queryClient.invalidateQueries({ queryKey: BOARDS_LIST_KEY });
      options?.onSuccess?.(newBoard);
    },
    onError: (error: Error) => {
      options?.onError?.(error);
    }
  });
}

export function useUpdateBoard() {
  const queryClient = useQueryClient();

  return useMutation({
    mutationFn: (board: Board) => boards.update(board),
    onMutate: async (board) => {
      // Cancel any outgoing refetches to prevent race conditions
      await queryClient.cancelQueries({ queryKey: ['board', board.id] });

      // Optimistically update the cache
      queryClient.setQueryData(['board', board.id], board);

      return { board };
    },
    onSuccess: () => {
      // Only invalidate the boards list (for sidebar, etc.)
      queryClient.invalidateQueries({ queryKey: BOARDS_QUERY_KEY });
      queryClient.invalidateQueries({ queryKey: BOARDS_LIST_KEY });
    }
  });
}

export function useDeleteBoard() {
  const queryClient = useQueryClient();

  return useMutation({
    mutationFn: (id: string) => boards.delete(id),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: BOARDS_QUERY_KEY });
      queryClient.invalidateQueries({ queryKey: BOARDS_LIST_KEY });
    }
  });
}


export function useDuplicateBoard() {
  const queryClient = useQueryClient();

  return useMutation({
    mutationFn: async (params: { board: Board; title?: string }) => {
      const { board, title } = params;
      const newTitle = title || `${board.title} (Copy)`;

      // Create a new board with the same content
      const newBoard = await boards.create(newTitle);

      // Update the new board with the content from the original board
      await boards.update({
        ...newBoard,
        content: board.content,
        excalidrawElements: board.excalidrawElements,
      });

      // Fetch the updated board to get the latest state
      const updatedBoard = await boards.getById(newBoard.id);
      return updatedBoard;
    },
    onSuccess: (newBoard) => {
      if (newBoard) {
        queryClient.setQueryData(['board', newBoard.id], newBoard);
        queryClient.invalidateQueries({ queryKey: BOARDS_QUERY_KEY });
        queryClient.invalidateQueries({ queryKey: BOARDS_LIST_KEY });
      }
    }
  });
}

export function useHistory(id: string | undefined) {
  const { data: session } = useSession();

  return useInfiniteQuery({
    queryKey: ['history', id],
    queryFn: async ({ pageParam }) => {
      if (!id) return { items: [], nextCursor: null };
      return boards.getHistory(id, 20, pageParam as number | undefined);
    },
    initialPageParam: undefined as number | undefined,
    getNextPageParam: (lastPage) => lastPage.nextCursor,
    enabled: !!id && !!session?.user
  });
}

export function useRevertBoard() {
  const queryClient = useQueryClient();

  return useMutation({
    mutationFn: (params: { id: string, version: number }) => boards.revert(params.id, params.version),
    onSuccess: (updatedBoard) => {
      queryClient.setQueryData(['board', updatedBoard.id], updatedBoard);
      queryClient.invalidateQueries({ queryKey: ['history', updatedBoard.id] });
      queryClient.invalidateQueries({ queryKey: BOARDS_QUERY_KEY });
      queryClient.invalidateQueries({ queryKey: BOARDS_LIST_KEY });
    }
  });
}

export function useToggleShare() {
  const queryClient = useQueryClient();

  return useMutation({
    mutationFn: (id: string) => boards.toggleShare(id),
    onSuccess: (updatedBoard) => {
      queryClient.setQueryData(['board', updatedBoard.id], updatedBoard);
      queryClient.invalidateQueries({ queryKey: BOARDS_QUERY_KEY });
      queryClient.invalidateQueries({ queryKey: BOARDS_LIST_KEY });
    }
  });
}

/**
 * Hook to track board access (updates lastAccessedAt or adds shared board)
 */
export function useTrackBoardAccess() {
  const queryClient = useQueryClient();

  return useMutation({
    mutationFn: (noteId: string) => boards.trackAccess(noteId),
    onSuccess: () => {
      // Refresh boards list to update lastAccessedAt
      queryClient.invalidateQueries({ queryKey: BOARDS_LIST_KEY });
    }
  });
}

/**
 * Hook to remove a shared board from user's list
 */
export function useRemoveSharedBoard() {
  const queryClient = useQueryClient();

  return useMutation({
    mutationFn: (noteId: string) => boards.removeShared(noteId),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: BOARDS_QUERY_KEY });
      queryClient.invalidateQueries({ queryKey: BOARDS_LIST_KEY });
    }
  });
}

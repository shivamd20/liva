import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import { boards } from '../boardsConfig';
import { Board } from '../types';
import { useSession } from '../lib/auth-client';

const BOARDS_QUERY_KEY = ['boards'];

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

export function useCreateBoard() {
  const queryClient = useQueryClient();

  return useMutation({
    mutationFn: (params: { title?: string, id?: string, expiresInHours?: number, templateId?: string }) => boards.create(params.title, params.id, params.expiresInHours, params.templateId),
    onSuccess: (newBoard) => {
      queryClient.setQueryData(['board', newBoard.id], newBoard);
      queryClient.invalidateQueries({ queryKey: BOARDS_QUERY_KEY });
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
    }
  });
}

export function useDeleteBoard() {
  const queryClient = useQueryClient();

  return useMutation({
    mutationFn: (id: string) => boards.delete(id),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: BOARDS_QUERY_KEY });
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
      }
    }
  });
}

import { useInfiniteQuery } from '@tanstack/react-query';

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
    }
  });
}


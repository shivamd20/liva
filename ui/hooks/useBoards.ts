import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import { boards } from '../boardsConfig';
import { Board } from '../types';

const BOARDS_QUERY_KEY = ['boards'];

export function useBoards() {
  return useQuery({
    queryKey: BOARDS_QUERY_KEY,
    queryFn: () => boards.getAll()
  });
}

export function useBoard(id: string | undefined) {
  return useQuery({
    queryKey: ['board', id],
    queryFn: () => id ? boards.getById(id) : null,
    enabled: !!id
  });
}

export function useCreateBoard() {
  const queryClient = useQueryClient();
  
  return useMutation({
    mutationFn: (params: { title?: string, id?: string }) => boards.create(params.title, params.id),
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

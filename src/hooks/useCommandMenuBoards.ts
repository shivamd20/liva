/**
 * Hook to lazily register boards as command menu items.
 * Only fetches board data when the command menu is opened to avoid
 * the N+1 waterfall issue with the legacy useBoards() hook.
 * 
 * This uses useBoardsList which fetches from the user's index
 * without the waterfall of fetching full board details for each entry.
 */
import { useEffect, useRef } from 'react';
import { useNavigate } from 'react-router-dom';
import { useCommandMenu } from '@/lib/command-menu-context';
import { useBoardsList } from './useBoards';

export function useCommandMenuBoards() {
  const navigate = useNavigate();
  const { registerCommand, unregisterCommand, isOpen } = useCommandMenu();
  const registeredIdsRef = useRef<Set<string>>(new Set());

  // Only fetch when command menu has been opened at least once
  const { data: boardsData } = useBoardsList({
    sortBy: 'lastAccessed',
    sortOrder: 'desc',
  });

  // Flatten paginated data
  const boardEntries = boardsData?.pages?.flatMap(page => page.items) ?? [];

  useEffect(() => {
    // Register new boards
    const newIds = new Set<string>();
    
    boardEntries.forEach(entry => {
      const commandId = `nav-board-${entry.noteId}`;
      newIds.add(commandId);
      
      if (!registeredIdsRef.current.has(commandId)) {
        registerCommand({
          id: commandId,
          title: entry.title || 'Untitled Board',
          action: () => navigate(`/board/${entry.noteId}`),
          section: 'Go to Board',
          keywords: ['board', 'switch', 'jump'],
        });
        registeredIdsRef.current.add(commandId);
      }
    });

    // Unregister removed boards
    registeredIdsRef.current.forEach(id => {
      if (!newIds.has(id)) {
        unregisterCommand(id);
        registeredIdsRef.current.delete(id);
      }
    });

    // Cleanup on unmount
    return () => {
      registeredIdsRef.current.forEach(id => {
        unregisterCommand(id);
      });
      registeredIdsRef.current.clear();
    };
  }, [boardEntries, registerCommand, unregisterCommand, navigate]);

  return { boardEntries };
}

/**
 * Hook for syncing Excalidraw elements with external state
 * 
 * Handles:
 * - Debounced local changes (400ms)
 * - Remote updates with version-based merge
 * - WebSocket subscription with loop prevention
 * - Infinite loop prevention
 */
import { useRef, useEffect, useCallback } from 'react';
import { ExcalidrawImperativeAPI } from '@excalidraw/excalidraw/types';
import { OrderedExcalidrawElement } from '@excalidraw/excalidraw/element/types';
import { mergeElements } from '../utils/excalidrawMerge';
import { Board } from '../types';

interface UseExcalidrawSyncOptions {
  excalidrawAPI: ExcalidrawImperativeAPI | null;
  board: Board;
  onLocalChange: (elements: OrderedExcalidrawElement[]) => void;
  onRemoteChange: (board: Board) => void;
  subscribeToChanges: (id: string, callback: (board: Board) => void) => () => void;
  debounceMs?: number;
  enabled?: boolean;
}

export function useExcalidrawSync({
  excalidrawAPI,
  board,
  onLocalChange,
  onRemoteChange,
  subscribeToChanges,
  debounceMs = 100,
  enabled = true,
}: UseExcalidrawSyncOptions) {
  const lastElementsRef = useRef<readonly OrderedExcalidrawElement[]>([]);
  const debounceTimeoutRef = useRef<ReturnType<typeof setTimeout> | undefined>(undefined);
  const lastRemoteUpdateRef = useRef<string>('');
  const lastBoardVersionRef = useRef<number>(board.updatedAt);

  // Debounced local change handler
  const handleLocalChange = useCallback(
    (elements: readonly OrderedExcalidrawElement[]) => {
      // Store a snapshot of the current elements immediately
      // This is crucial because Excalidraw mutates the elements array
      const elementsSnapshot = JSON.stringify(elements);

      // Clear previous debounce
      if (debounceTimeoutRef.current) {
        clearTimeout(debounceTimeoutRef.current);
      }

      // Debounce before sending to parent (prevents rapid updates)
      debounceTimeoutRef.current = setTimeout(() => {
        // Deep comparison to avoid unnecessary updates
        const lastStr = JSON.stringify(lastElementsRef.current);
        if (elementsSnapshot !== lastStr) {
          // Parse the snapshot back to array
          const parsedElements = JSON.parse(elementsSnapshot) as OrderedExcalidrawElement[];
          lastElementsRef.current = parsedElements;
          lastRemoteUpdateRef.current = elementsSnapshot; // Track what we sent
          onLocalChange(parsedElements);
        }
      }, debounceMs);
    },
    [onLocalChange, debounceMs]
  );

  // Handle remote updates (when board.excalidrawElements prop changes)
  useEffect(() => {
    if (!enabled || !excalidrawAPI || !board.excalidrawElements) return;

    const incomingStr = JSON.stringify(board.excalidrawElements);

    // Skip if this is the same version we already processed
    if (board.updatedAt === lastBoardVersionRef.current) {
      return;
    }

    // Skip if this is our own change that just came back
    if (incomingStr === lastRemoteUpdateRef.current) {
      lastBoardVersionRef.current = board.updatedAt;
      return;
    }

    // Skip if nothing changed
    if (incomingStr === JSON.stringify(lastElementsRef.current)) {
      lastBoardVersionRef.current = board.updatedAt;
      return;
    }

    console.log('Applying remote update to canvas', { version: board.updatedAt });

    // Apply remote update with merge
    const currentElements = excalidrawAPI.getSceneElements();
    const merged = mergeElements(currentElements, board.excalidrawElements);

    // Only update if something changed
    if (JSON.stringify(merged) !== JSON.stringify(currentElements)) {
      excalidrawAPI.updateScene({
        elements: merged,
        appState: excalidrawAPI.getAppState(),
      });
      lastElementsRef.current = merged;
    }

    lastBoardVersionRef.current = board.updatedAt;
  }, [excalidrawAPI, board.excalidrawElements, board.updatedAt, enabled]);

  // Subscribe to WebSocket changes with loop prevention
  useEffect(() => {
    if (!enabled) return;

    const unsubscribe = subscribeToChanges(board.id, (updatedBoard) => {
      // Skip if this is the same version we already have (prevents loops)


      if (updatedBoard.updatedAt === lastBoardVersionRef.current) {
        return;
      }

      // Skip if this is our own change that just came back
      const incomingStr = JSON.stringify(updatedBoard.excalidrawElements);
      if (incomingStr === lastRemoteUpdateRef.current) {
        // Update version but don't trigger re-render
        lastBoardVersionRef.current = updatedBoard.updatedAt;
        return;
      }

      // This is a genuine remote change
      // DON'T update lastRemoteUpdateRef here - that's only for tracking our own changes
      // The remote update effect will handle applying this change
      console.log({ updatedBoard });
      onRemoteChange(updatedBoard);
    });

    return () => {
      unsubscribe();
    };
  }, [board.id, subscribeToChanges, onRemoteChange, enabled]);

  // Cleanup
  useEffect(() => {
    return () => {
      if (debounceTimeoutRef.current) {
        clearTimeout(debounceTimeoutRef.current);
      }
    };
  }, []);

  return { handleLocalChange };
}

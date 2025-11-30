/**
 * BoardEditor - Excalidraw component with bidirectional sync
 * 
 * Clean component that delegates sync logic to useExcalidrawSync hook
 */
import { Board } from '../types';
import { Excalidraw, MainMenu } from '@excalidraw/excalidraw';
import { ExcalidrawImperativeAPI } from '@excalidraw/excalidraw/types';
import { OrderedExcalidrawElement } from '@excalidraw/excalidraw/element/types';
import '@excalidraw/excalidraw/index.css';
import { ReactNode, useRef, useCallback, useEffect } from 'react';
import { useExcalidrawSync } from '../hooks/useExcalidrawSync';
import { boardsAPI as defaultBoardsAPI } from '../boardsConfig';
import { BoardsAPI } from '../boards';
import { useQueryClient } from '@tanstack/react-query';

interface BoardEditorProps {
  board: Board;
  onChange: (board: Board) => void;
  menuItems?: ReactNode;
  syncEnabled?: boolean;
  onPointerDown?: (activeTool: any, pointerDownState: any) => void;
  boardsAPI?: BoardsAPI;
  onLinkOpen?: (element: OrderedExcalidrawElement, event: CustomEvent<{ nativeEvent: MouseEvent }>) => void;
}

export function BoardEditor({
  board,
  onChange,
  menuItems,
  syncEnabled = true,
  onPointerDown,
  boardsAPI = defaultBoardsAPI,
  onLinkOpen
}: BoardEditorProps) {
  const excalidrawAPIRef = useRef<ExcalidrawImperativeAPI | null>(null);
  const queryClient = useQueryClient();

  // Memoize callbacks to prevent unnecessary re-subscriptions
  const handleLocalChange = useCallback(
    (elements: OrderedExcalidrawElement[]) => {
      onChange({
        ...board,
        excalidrawElements: elements,
      });
    },
    [board, onChange]
  );

  // Handle remote changes by updating cache directly (don't call onChange which triggers API)
  const handleRemoteChange = useCallback(
    (updatedBoard: Board) => {
      queryClient.setQueryData(['board', updatedBoard.id], updatedBoard);
    },
    [queryClient]
  );

  const subscribeToChanges = useCallback(
    (id: string, callback: (board: Board) => void) => {
      return boardsAPI.subscribeToChanges(id, callback);
    },
    []
  );

  // Sync hook handles debouncing, merging, WebSocket subscription, and loop prevention
  const { handleLocalChange: debouncedLocalChange } = useExcalidrawSync({
    excalidrawAPI: excalidrawAPIRef.current,
    board,
    onLocalChange: handleLocalChange,
    onRemoteChange: handleRemoteChange,
    subscribeToChanges,
    enabled: syncEnabled,
  });

  useEffect(() => {
    window.document.title = board.title
  }, [
    board.title
  ])

  return (
    <div className="flex-1 h-screen bg-white">
      <Excalidraw
        excalidrawAPI={(api) => {
          excalidrawAPIRef.current = api;
        }}
        initialData={{
          elements: board.excalidrawElements || [],
        }}
        onChange={(elements) => {
          debouncedLocalChange(elements);
        }}
        onPointerDown={onPointerDown}
        onLinkOpen={onLinkOpen}
      >
        {menuItems && <MainMenu>{menuItems}</MainMenu>}
      </Excalidraw>
    </div>
  );
}

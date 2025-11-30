/**
 * BoardEditor - Excalidraw component with bidirectional sync
 * 
 * Clean component that delegates sync logic to useExcalidrawSync hook
 */
import { Board } from '../types';
import { Excalidraw, LiveCollaborationTrigger, MainMenu } from '@excalidraw/excalidraw';
import { ExcalidrawImperativeAPI, SocketId, Collaborator } from '@excalidraw/excalidraw/types';
import { OrderedExcalidrawElement, NonDeletedExcalidrawElement } from '@excalidraw/excalidraw/element/types';
import '@excalidraw/excalidraw/index.css';
import { ReactNode, useRef, useCallback, useEffect, useState } from 'react';
import { useExcalidrawSync } from '../hooks/useExcalidrawSync';
import { boardsAPI as defaultBoardsAPI } from '../boardsConfig';
import { BoardsAPI } from '../boards';
import { useQueryClient } from '@tanstack/react-query';
import { getUserProfile } from '../utils/userIdentity';
import { useSession } from '../lib/auth-client';
import { toast } from 'sonner';

interface BoardEditorProps {
  board: Board;
  onChange: (board: Board) => void;
  menuItems?: ReactNode;
  syncEnabled?: boolean;
  onPointerDown?: (activeTool: any, pointerDownState: any) => void;
  boardsAPI?: BoardsAPI;
  onLinkOpen?: (element: NonDeletedExcalidrawElement, event: CustomEvent<{ nativeEvent: MouseEvent | React.PointerEvent<HTMLCanvasElement> }>) => void;
}

export function BoardEditor({
  board,
  // onChange is now unused in favor of updateViaWS, but kept for props interface
  onChange,
  menuItems,
  syncEnabled = true,
  onPointerDown,
  boardsAPI = defaultBoardsAPI,
  onLinkOpen
}: BoardEditorProps) {
  const excalidrawAPIRef = useRef<ExcalidrawImperativeAPI | null>(null);
  const queryClient = useQueryClient();
  const [collaborators, setCollaborators] = useState<Map<SocketId, Collaborator>>(new Map());
  const [userProfile] = useState(() => getUserProfile());
  const { data: session } = useSession();
  const userId = session?.user?.id;
  const isOwner = userId && userId === board.userId;

  console.log({
    board,userId,isOwner
  });

  // Memoize callbacks to prevent unnecessary re-subscriptions
  const handleLocalChange = useCallback(
    (elements: OrderedExcalidrawElement[]) => {
      const updatedBoard = {
        ...board,
        excalidrawElements: elements,
      };
      // Use WebSocket update for faster latency
      boardsAPI.updateViaWS(updatedBoard);
    },
    [board, boardsAPI]
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

  // Subscribe to ephemeral events (cursors, etc.)
  useEffect(() => {
    if (!syncEnabled) return;

    const handleEphemeral = (msg: any) => {
      if (msg.type === 'ephemeral') {
        const { senderId, data } = msg;
        
        // data is null when user disconnects
        if (data === null) {
          setCollaborators(prev => {
            const next = new Map(prev);
            next.delete(senderId as SocketId);
            return next;
          });
          return;
        }

        if (data.type === 'pointer') {
          setCollaborators(prev => {
            const next = new Map(prev);
            // Only update if changed to avoid thrashing (though React state updates are somewhat optimized)
            // But here we create a new Map every time, which triggers re-render.
            // Excalidraw might handle frequent updates well.
            next.set(senderId as SocketId, {
              id: senderId,
              username: data.payload.username || 'User',
              avatarUrl: data.payload.avatarUrl,
              color: data.payload.color || { background: '#999', stroke: '#999' },
              pointer: {
                x: data.payload.pointer.x,
                y: data.payload.pointer.y,
                tool: "pointer" 
              }
            });
            return next;
          });
        }
      } else if (msg.type === 'ephemeral_state') {
        // Initial state of others
        const newCollaborators = new Map<SocketId, Collaborator>();
        Object.entries(msg.data).forEach(([id, data]: [string, any]) => {
          if (data && data.type === 'pointer') {
            newCollaborators.set(id as SocketId, {
              id: id,
              username: data.payload.username || 'User',
              avatarUrl: data.payload.avatarUrl,
              color: data.payload.color || { background: '#999', stroke: '#999' },
              pointer: {
                x: data.payload.pointer.x,
                y: data.payload.pointer.y,
                tool: "pointer"
              }
            });
          }
        });
        setCollaborators(newCollaborators);
      }
    };

    return boardsAPI.subscribeToEphemeral(board.id, handleEphemeral);
  }, [board.id, syncEnabled, boardsAPI]);

  // Update Excalidraw scene when collaborators change
  useEffect(() => {
    if (excalidrawAPIRef.current) {
      excalidrawAPIRef.current.updateScene({ collaborators });
    }
  }, [collaborators]);

  const onPointerUpdate = useCallback((payload: { pointer: { x: number; y: number }, button: 'down' | 'up', pointersMap: any }) => {
    if (!syncEnabled) return;
    
    boardsAPI.sendEphemeral(board.id, {
      type: 'pointer',
      payload: {
        pointer: payload.pointer,
        button: payload.button,
        username: userProfile.username,
        avatarUrl: userProfile.avatarUrl,
        color: userProfile.color,
      }
    });
  }, [board.id, syncEnabled, boardsAPI, userProfile]);

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
        isCollaborating={board.access === 'public'}
        renderTopRightUI={() => (
          isOwner ? (
            <LiveCollaborationTrigger
              isCollaborating={board.access === 'public'}
              onSelect={async () => {
                const updated = await boardsAPI.toggleShare(board.id);
                if (updated.access === 'public') {
                    toast.success("Public access enabled");
                } else {
                    toast.success("Public access disabled");
                }
              }}
            />
          ) : null
        )}
        onPointerUpdate={onPointerUpdate}
        onPointerDown={onPointerDown}
        onLinkOpen={onLinkOpen}
      >
        {menuItems && <MainMenu>{menuItems}</MainMenu>}
      </Excalidraw>
    </div>
  );
}

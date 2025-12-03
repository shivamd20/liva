/**
 * BoardEditor - Premium mobile-responsive Excalidraw component
 * 
 * Features:
 * - Responsive layout with mobile/tablet/desktop optimizations
 * - Dynamic toolbar positioning based on screen size
 * - Touch-friendly UI with proper target sizes
 * - Safe area insets for notched devices
 * - Optimized UI options per device type
 */
import { Board } from '../types';
import { Excalidraw, MainMenu } from '@excalidraw/excalidraw';
import { Share2, Globe } from 'lucide-react';
import { ExcalidrawImperativeAPI, SocketId, Collaborator } from '@excalidraw/excalidraw/types';
import { OrderedExcalidrawElement, NonDeletedExcalidrawElement } from '@excalidraw/excalidraw/element/types';
import '@excalidraw/excalidraw/index.css';
import '../styles/excalidraw-mobile.css';
import { ReactNode, useRef, useCallback, useEffect, useState, useMemo } from 'react';
import { useExcalidrawSync } from '../hooks/useExcalidrawSync';
import { useResponsive } from '../hooks/useResponsive';
import { boardsAPI as defaultBoardsAPI } from '../boardsConfig';
import { BoardsAPI } from '../boards';
import { useQueryClient } from '@tanstack/react-query';
import { getUserProfile } from '../utils/userIdentity';
import { useSession } from '../lib/auth-client';
import { toast } from 'sonner';
import { useTheme } from 'next-themes';


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
  const { data: session } = useSession();
  const userProfile = useMemo(() => getUserProfile(session), [session]);
  const userId = session?.user?.id;
  const isOwner = !!(userId && userId === board.userId);
  const { isMobile, isTablet } = useResponsive();
  const { theme } = useTheme();



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

  // Responsive UI options based on device type
  const uiOptions = useMemo(() => {
    // Mobile: simplified UI
    if (isMobile) {
      return {
        canvasActions: {
          loadScene: false as const,
          changeViewBackgroundColor: false as const,
          export: false as const,
        },
        dockedSidebarBreakpoint: 0,
      } as const;
    }

    // Tablet: balanced UI
    if (isTablet) {
      return {
        canvasActions: {
          loadScene: false as const,
        },
        dockedSidebarBreakpoint: 768,
      } as const;
    }

    // Desktop: full UI
    return {
      canvasActions: {
        loadScene: false as const,
      },
    } as const;
  }, [isMobile, isTablet]);

  // Handle pointer events with touch sensitivity adjustments
  const handlePointerDown = useCallback(
    (activeTool: any, pointerDownState: any) => {
      // Reduce gesture sensitivity on touch devices if needed
      if (pointerDownState.pointerType === 'touch' && isMobile) {
        // Touch-specific handling can be added here
      }
      onPointerDown?.(activeTool, pointerDownState);
    },
    [onPointerDown, isMobile]
  );

  return (
    <div
      className="excalidraw-wrapper"
      style={{
        '--color-primary': '#3B82F6',
        '--color-primary-dark': '#2563EB',
        '--color-primary-light': '#93C5FD'
      } as React.CSSProperties}
    >
      <Excalidraw
        excalidrawAPI={(api) => {
          excalidrawAPIRef.current = api;
        }}
        theme={theme}
        initialData={{
          elements: board.excalidrawElements || [],
        }}
        onChange={(elements) => {
          debouncedLocalChange(elements);
        }}
        isCollaborating={board.access === 'public'}
        UIOptions={uiOptions}
        renderTopRightUI={() => (
          isOwner ? (
            <button
              onClick={async () => {
                const updated = await boardsAPI.toggleShare(board.id);
                if (updated.access === 'public') {
                  await navigator.clipboard.writeText(window.location.href);
                  toast.success("Public access enabled. Link copied to clipboard!");
                } else {
                  toast.success("Public access disabled");
                }
              }}
              className={`flex items-center gap-2 ${isMobile ? 'px-3 py-2' : 'px-4 py-2'} text-sm font-bold text-white rounded-lg transition-all shadow-md hover:shadow-lg active:scale-95 ${board.access === 'public'
                ? 'bg-gradient-to-r from-green-500 to-emerald-600 hover:from-green-600 hover:to-emerald-700'
                : 'bg-gradient-to-r from-[#3B82F6] to-[#06B6D4] hover:from-[#2563EB] hover:to-[#0891B2]'
                }`}
              style={{
                minWidth: isMobile ? '48px' : '44px',
                minHeight: isMobile ? '48px' : '44px',
                touchAction: 'manipulation',
              }}
            >
              {board.access === 'public' ? <Globe className="w-4 h-4" /> : <Share2 className="w-4 h-4" />}
              {!isMobile && (board.access === 'public' ? 'Public' : 'Share')}
            </button>
          ) : null
        )}
        onPointerUpdate={onPointerUpdate}
        onPointerDown={handlePointerDown}
        onLinkOpen={onLinkOpen}
      >
        {menuItems && <MainMenu>{menuItems}</MainMenu>}
      </Excalidraw>
    </div>
  );
}

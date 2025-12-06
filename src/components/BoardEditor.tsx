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
import { Sparkles } from 'lucide-react';
import { BoardSidebar, BoardSidebarTriggers } from './BoardSidebar';
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
import { useCommandMenu } from '../lib/command-menu-context';
import { trpcClient } from '../trpcClient';
import { mixpanelService, MixpanelEvents } from '../lib/mixpanel';
import { SpeechProvider } from '../contexts/SpeechContext';


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
  const [excalidrawAPI, setExcalidrawAPI] = useState<ExcalidrawImperativeAPI | null>(null);
  const excalidrawAPIRef = useRef<ExcalidrawImperativeAPI | null>(null);

  useEffect(() => {
    if (excalidrawAPI) {
      excalidrawAPIRef.current = excalidrawAPI;
    }
  }, [excalidrawAPI]);
  const queryClient = useQueryClient();
  const [collaborators, setCollaborators] = useState<Map<SocketId, Collaborator>>(new Map());
  const { data: session } = useSession();
  const userProfile = useMemo(() => getUserProfile(session), [session]);
  const userId = session?.user?.id;
  const isOwner = !!(userId && userId === board.userId);
  const { isMobile, isTablet } = useResponsive();
  const { theme } = useTheme();

  // ... imports

  const { registerCommand, unregisterCommand } = useCommandMenu();




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

  const handleAskAI = useCallback(async () => {
    const instruction = window.prompt("What would you like to do with this board?");
    if (!instruction) return;

    const toastId = toast.loading("AI is thinking...");
    mixpanelService.track(MixpanelEvents.AI_GENERATE_START, { boardId: board.id, queryLength: instruction.length });

    try {
      const elements = excalidrawAPIRef.current?.getSceneElements();
      if (!elements) throw new Error("Could not get board elements");

      const result = await trpcClient.ai.transformWithAI.mutate({
        query: instruction,
        elements: elements as any,
        constraints: {
          allowDelete: true,
          allowNewElements: true,
        }
      });

      if (result && result.updatedElements) {
        const updatedBoard = {
          ...board,
          excalidrawElements: result.updatedElements as unknown as OrderedExcalidrawElement[]
        };
        boardsAPI.updateViaWS(updatedBoard);
        toast.success("Board updated by AI", { id: toastId });
        mixpanelService.track(MixpanelEvents.AI_GENERATE_SUCCESS, { boardId: board.id });
      } else {
        toast.error("AI returned no changes", { id: toastId });
        mixpanelService.track(MixpanelEvents.AI_GENERATE_ERROR, { boardId: board.id, reason: 'No changes' });
      }

    } catch (error) {
      console.error(error);
      toast.error("Failed to process AI request", { id: toastId });
      mixpanelService.track(MixpanelEvents.AI_GENERATE_ERROR, { boardId: board.id, error: String(error) });
    }
  }, [board, boardsAPI]);

  useEffect(() => {
    const command = {
      id: 'ask-ai',
      title: 'Ask AI',
      icon: <Sparkles className="w-4 h-4" />,
      action: handleAskAI,
      section: 'AI Tools',
      shortcut: ['Meta', 'J']
    };

    registerCommand(command);
    return () => unregisterCommand(command.id);
  }, [registerCommand, unregisterCommand, handleAskAI]);

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
    <SpeechProvider excalidrawAPIRef={excalidrawAPIRef}>
      <div
        className="excalidraw-wrapper"
        style={{
          '--color-primary': '#3B82F6',
          '--color-primary-dark': '#2563EB',
          '--color-primary-light': '#93C5FD',
          '--right-sidebar-width': '400px',
        } as React.CSSProperties}
      >
        <Excalidraw
          excalidrawAPI={(api) => setExcalidrawAPI(api)}
          theme={theme == 'dark' ? 'dark' : 'light'}
          initialData={{
            elements: board.excalidrawElements || [],
          }}
          onChange={(elements) => {
            debouncedLocalChange(elements);
          }}
          isCollaborating={board.access === 'public'}
          UIOptions={uiOptions}
          renderTopRightUI={() => (
            <BoardSidebarTriggers
              isMobile={isMobile}
              isShared={board.access === 'public'}
            />
          )}
          onPointerUpdate={onPointerUpdate}
          onPointerDown={handlePointerDown}
          onLinkOpen={onLinkOpen}
        >
          {menuItems && <MainMenu>{menuItems}</MainMenu>}
          <div style={{
            '--color-primary': '#3B82F6',
            '--color-primary-dark': '#2563EB',
            '--color-primary-light': '#93C5FD',
            '--right-sidebar-width': '400px',
          } as React.CSSProperties}>
            <BoardSidebar board={board} isOwner={isOwner} />
          </div>

        </Excalidraw>
      </div >
    </SpeechProvider >
  );
}

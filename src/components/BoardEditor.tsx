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
import { Share2, MessageCircle, Globe } from 'lucide-react';
import { AssistantPanel } from './AssistantPanel';
import { TopBar } from './TopBar';
import { ExcalidrawImperativeAPI, SocketId, Collaborator } from '@excalidraw/excalidraw/types';
import { cn } from '../lib/utils';
import { OrderedExcalidrawElement, NonDeletedExcalidrawElement } from '@excalidraw/excalidraw/element/types';
import '@excalidraw/excalidraw/index.css';
import '../styles/excalidraw-custom.css';
// import '../styles/excalidraw-mobile.css';
import { ReactNode, useRef, useCallback, useEffect, useState, useMemo } from 'react';
import { useExcalidrawLiveSync } from '@shvm/excalidraw-live-sync';
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
import { useQuery } from '@tanstack/react-query';
import { TopBarMenuItem } from './TopBar';

interface BoardEditorProps {
  board: Board;
  onChange: (board: Board) => void;
  menuItems?: TopBarMenuItem[];
  syncEnabled?: boolean;
  onPointerDown?: (activeTool: any, pointerDownState: any) => void;
  boardsAPI?: BoardsAPI;
  onLinkOpen?: (element: NonDeletedExcalidrawElement, event: CustomEvent<{ nativeEvent: MouseEvent | React.PointerEvent<HTMLCanvasElement> }>) => void;
  onBack?: () => void;
  onTitleChange?: (newTitle: string) => void;
}

export function BoardEditor({
  board,
  // onChange is now unused in favor of updateViaWS, but kept for props interface
  onChange,
  menuItems,
  syncEnabled = true,
  onPointerDown,
  boardsAPI = defaultBoardsAPI,
  onLinkOpen,
  onBack,
  onTitleChange
}: BoardEditorProps) {
  const [excalidrawAPI, setExcalidrawAPI] = useState<ExcalidrawImperativeAPI | null>(null);
  const excalidrawAPIRef = useRef<ExcalidrawImperativeAPI | null>(null);

  useEffect(() => {
    if (excalidrawAPI) {
      excalidrawAPIRef.current = excalidrawAPI;
    }
  }, [excalidrawAPI]);
  const queryClient = useQueryClient();

  const { data: session } = useSession();
  const userProfile = useMemo(() => getUserProfile(session), [session]);
  const userId = session?.user?.id;
  const isOwner = !!(userId && userId === board.userId);
  const { isMobile, isTablet } = useResponsive();
  const { theme } = useTheme();

  // ... imports

  const { registerCommand, unregisterCommand } = useCommandMenu();




  // Use the library for syncing
  const { handleChange, onPointerUpdate } = useExcalidrawLiveSync({
    excalidrawAPI: excalidrawAPIRef.current,
    boardId: board.id,
    userId: userId || 'anonymous',
    userInfo: {
      username: userProfile.username,
      avatarUrl: userProfile.avatarUrl,
      color: userProfile.color,
    },
    baseUrl: typeof window !== 'undefined' ? window.location.origin : undefined,
  });

  useEffect(() => {
    window.document.title = board.title
  }, [
    board.title
  ])



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
        const updatedElements = result.updatedElements as unknown as OrderedExcalidrawElement[];

        // Update local scene
        excalidrawAPIRef.current?.updateScene({
          elements: updatedElements
        });

        // Sync changes
        handleChange(updatedElements);

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

  const [activePanelTab, setActivePanelTab] = useState<'share' | 'conversation' | null>(null);
  const [isPanelPinned, setIsPanelPinned] = useState(true);

  const togglePanel = (tab: 'share' | 'conversation') => {
    setActivePanelTab(current => current === tab ? null : tab);
  };

  const handleBoardSubmit = () => {
    // Placeholder implementation for now
    alert("Board submitted! (This is a placeholder)");
  };

  const { data: template } = useQuery({
    queryKey: ['template', board.templateId],
    queryFn: () => trpcClient.templates.get.query({ id: board.templateId! }),
    enabled: !!board.templateId
  });

  console.log(template);

  return (
    <SpeechProvider excalidrawAPIRef={excalidrawAPIRef} systemInstruction={template?.content}>
      <div className="flex h-full w-full overflow-hidden relative bg-background flex-col">
        <TopBar
          board={board}
          onSubmit={handleBoardSubmit}
          menuItems={menuItems || []}
          onToggleShare={() => togglePanel('share')}
          onToggleChat={() => togglePanel('conversation')}
          isShareOpen={activePanelTab === 'share'}
          isChatOpen={activePanelTab === 'conversation'}
          onBack={onBack || (() => { })}
          onTitleChange={onTitleChange || (() => { })}
        />

        <div className="flex-1 relative flex overflow-hidden w-full h-full">
          <div className={cn(
            "h-full transition-all duration-300 ease-in-out relative",
            (activePanelTab && isPanelPinned) ? "flex-1 w-[calc(100%-400px)]" : "w-full"
          )}>
            <Excalidraw
              viewModeEnabled={!!(board.expiresAt && Date.now() > board.expiresAt)}
              excalidrawAPI={(api) => setExcalidrawAPI(api)}
              theme={theme == 'dark' ? 'dark' : 'light'}
              initialData={{
                elements: board.excalidrawElements || [],
              }}
              onChange={(elements) => {
                handleChange(elements);
              }}
              isCollaborating={board.access === 'public'}
              UIOptions={uiOptions}
              // renderTopRightUI is removed as it's now in TopBar
              onPointerUpdate={onPointerUpdate}
              onPointerDown={handlePointerDown}
              onLinkOpen={onLinkOpen}
            >
            </Excalidraw>
          </div>

          <div className={cn(
            "fixed top-12 bottom-0 right-0 z-[50] w-[400px] bg-background border-l shadow-2xl transition-transform duration-300 ease-in-out",
            activePanelTab ? "translate-x-0" : "translate-x-full"
          )}>
            <AssistantPanel
              isOpen={!!activePanelTab}
              activeTab={activePanelTab}
              isPinned={isPanelPinned}
              onTogglePin={() => setIsPanelPinned(!isPanelPinned)}
              onClose={() => setActivePanelTab(null)}
              board={board}
              isOwner={isOwner}
            />
          </div>
        </div>
      </div >
    </SpeechProvider >
  );
}

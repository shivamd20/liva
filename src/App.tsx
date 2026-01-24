import { Routes, Route, useParams, useNavigate, useLocation, Navigate } from 'react-router-dom';
import { DemoLiveBoard } from './examples/DemoLiveBoard';
import { BoardEditor } from './components/BoardEditor';

import { LandingPage } from './components/LandingPage';
import { PrivacyPolicy } from './components/PrivacyPolicy';

import { MainMenu } from '@excalidraw/excalidraw';
import { Board } from './types';
import { useBoards, useBoard, useUpdateBoard, useDeleteBoard } from './hooks/useBoards';
import { useCallback } from 'react';
import { useSession, signIn } from './lib/auth-client';
import BoardsPage from './components/boards/boards-page';
import { useTheme } from 'next-themes';
import { CommandMenuProvider } from '@/lib/command-menu-context';
import { CommandMenu } from '@/components/command-menu';
import { NewBoardRedirect } from './components/NewBoardRedirect';
import { TestAI } from './components/TestAI';
import { IntegrationsPage } from './components/IntegrationsPage';
import { useQuery } from '@tanstack/react-query';
import { LoadingScreen } from './components/LoadingScreen';
import { BoardNotFound } from './components/BoardNotFound';

import { useDuplicateBoard } from './hooks/useBoards';
import { HistoryModal } from './components/HistoryModal';
import { boardsAPI } from './boardsConfig';
import { toast } from 'sonner';
import { useCommandMenu } from '@/lib/command-menu-context';
import { Copy, Trash, History, Share2, Globe, Edit2 } from 'lucide-react';
import { useState, useEffect } from 'react';
import { mixpanelService, MixpanelEvents } from './lib/mixpanel';
import { SpeechDemo } from './components/Speech';
import { CanvasDrawDemo } from './components/CanvasDrawDemo';
import { ConversationTest } from './components/ConversationTest';

function BoardView({
  allBoards,
  onNewBoard,
  onDeleteBoard
}: {
  allBoards: Board[];
  onNewBoard: () => void;
  onDeleteBoard: (id: string) => void;
}) {
  const { id } = useParams<{ id: string }>();
  const { data: session } = useSession();
  const { data: board, isPending: isLoading } = useBoard(id);
  const updateBoard = useUpdateBoard();
  const duplicateBoard = useDuplicateBoard();
  const navigate = useNavigate();
  const { registerCommand, unregisterCommand } = useCommandMenu();
  const [isHistoryOpen, setIsHistoryOpen] = useState(false);

  const handleBoardChange = useCallback((updated: Board) => {
    updateBoard.mutate(updated);
  }, [updateBoard]);

  useEffect(() => {
    if (board) {
      mixpanelService.track(MixpanelEvents.BOARD_OPEN, { boardId: board.id, title: board.title });
    }
  }, [board?.id]);

  const { theme, setTheme } = useTheme();

  // Check YouTube integration status
  const { data: ytStatus } = useQuery({
    queryKey: ['youtube-status', session?.user?.id],
    queryFn: async () => {
      if (!session?.user?.id) return { connected: false };
      try {
        const res = await fetch('/api/integrations/youtube', {
          headers: { 'X-Liva-User-Id': session.user.id }
        });
        if (!res.ok) return { connected: false };
        return (await res.json()) as { connected: boolean; channels: any[] };
      } catch (e) {
        return { connected: false };
      }
    },
    enabled: !!session?.user?.id,
    staleTime: 60000
  });

  // Register Board Commands
  useEffect(() => {
    if (!board) return;

    const commands = [
      {
        id: 'rename-board',
        title: 'Rename Board',
        icon: <Edit2 className="w-4 h-4" />,
        action: handleRenameBoard,
        section: 'Current Board'
      },
      {
        id: 'duplicate-board',
        title: 'Duplicate Board',
        icon: <Copy className="w-4 h-4" />,
        action: handleDuplicate,
        section: 'Current Board'
      },
      {
        id: 'board-history',
        title: 'Board History',
        icon: <History className="w-4 h-4" />,
        action: () => {
          mixpanelService.track(MixpanelEvents.BOARD_HISTORY_OPEN, { boardId: board.id });
          setIsHistoryOpen(true);
        },
        section: 'Current Board'
      },
      {
        id: 'toggle-share',
        title: board.access === 'public' ? 'Make Private' : 'Share Publicly',
        icon: board.access === 'public' ? <Globe className="w-4 h-4" /> : <Share2 className="w-4 h-4" />,
        action: handleToggleShare,
        section: 'Current Board'
      },
      {
        id: 'delete-board',
        title: 'Delete Board',
        icon: <Trash className="w-4 h-4" />,
        action: () => {
          if (window.confirm('Delete this board?')) {
            if (id) {
              mixpanelService.track(MixpanelEvents.BOARD_DELETE, { boardId: id, source: 'Command Menu' });
              onDeleteBoard(id);
            }
          }
        },
        section: 'Current Board'
      }
    ];

    commands.forEach(registerCommand);

    return () => {
      commands.forEach(c => unregisterCommand(c.id));
    };
  }, [board, registerCommand, unregisterCommand, id]);

  if (!session?.user) {
    return <div className="h-screen w-full bg-gray-50" />; // Placeholder behind auth dialog
  }

  if (isLoading) return <LoadingScreen />;
  if (!board) return <BoardNotFound />;

  const handleRenameBoard = () => {
    const newTitle = window.prompt('Enter new board name:', board.title || 'Untitled');
    if (newTitle !== null) {
      handleTitleChange(newTitle);
    }
  };

  const handleTitleChange = (newTitle: string) => {
    mixpanelService.track(MixpanelEvents.BOARD_RENAME, { boardId: board.id, newTitle });
    handleBoardChange({ ...board, title: newTitle });
  };

  const handleDuplicate = () => {
    const title = window.prompt('Enter name for duplicated board:', `${board.title} (Copy)`);
    if (title) {
      duplicateBoard.mutate({ board, title }, {
        onSuccess: (newBoard) => {
          if (newBoard) {
            navigate(`/board/${newBoard.id}`);
            toast.success("Board duplicated successfully");
            mixpanelService.track(MixpanelEvents.BOARD_DUPLICATE, { sourceId: board.id, newId: newBoard.id });
          }
        }
      });
    }
  };

  const handleToggleShare = async () => {
    try {
      const updated = await boardsAPI.toggleShare(board.id);
      if (updated.access === 'public') {
        await navigator.clipboard.writeText(window.location.href);
        toast.success("Public access enabled. Link copied to clipboard!");
      } else {
        toast.success("Public access disabled");
      }
      // Optimistically update local state or refetch is handled by react-query usually
      // But we might need to manually trigger update if not handled
      handleBoardChange(updated);
      mixpanelService.track(MixpanelEvents.BOARD_SHARE_TOGGLE, { boardId: board.id, isPublic: updated.access === 'public' });
    } catch (error) {
      toast.error("Failed to toggle share settings");
    }
  };



  const handleSwitchTheme = () => {
    setTheme(theme === 'dark' ? 'light' : 'dark');
  };

  /* 
   * Construct menu items for TopBar
   */
  const menuItems = [
    {
      label: 'New Board',
      onClick: onNewBoard,
      icon: null
    },
    {
      label: 'Rename Board',
      onClick: handleRenameBoard,
      icon: <Edit2 className="w-4 h-4" />
    },
    {
      label: 'Duplicate Board',
      onClick: handleDuplicate,
      icon: <Copy className="w-4 h-4" />
    },
    {
      label: 'History',
      onClick: () => {
        mixpanelService.track(MixpanelEvents.BOARD_HISTORY_OPEN, { boardId: board.id });
        setIsHistoryOpen(true);
      },
      icon: <History className="w-4 h-4" />
    },
    {
      label: `Switch to ${theme === 'dark' ? 'light' : 'dark'} mode`,
      onClick: handleSwitchTheme,
      icon: null,
      separator: true
    },
    // "Return to Boards" removed as we now have a dedicated Back button
    ...(allBoards.length > 1 && id ? [{
      label: 'Delete Current Board',
      onClick: () => {
        if (window.confirm('Delete this board?')) {
          mixpanelService.track(MixpanelEvents.BOARD_DELETE, { boardId: id, source: 'Main Menu' });
          onDeleteBoard(id);
        }
      },
      icon: <Trash className="w-4 h-4" />,
      variant: 'destructive' as const
    }] : [])
  ];

  return (
    <>
      <BoardEditor
        board={board}
        onChange={handleBoardChange}
        menuItems={menuItems}
        key={id}
        onBack={() => navigate('/board')}
        onTitleChange={handleTitleChange}
        onConnectYouTube={ytStatus?.connected === false ? () => navigate('/app/integrations') : undefined}
      />
      {isHistoryOpen && (
        <HistoryModal
          isOpen={isHistoryOpen}
          onClose={() => setIsHistoryOpen(false)}
          boardId={board.id}
          boardTitle={board.title}
        />
      )}
    </>
  );
}

function AppContent() {
  const { data: allBoards = [] } = useBoards();
  const deleteBoard = useDeleteBoard();
  const navigate = useNavigate();
  const location = useLocation();
  const { data: session, isPending: isAuthPending } = useSession();
  const { registerCommand, unregisterCommand } = useCommandMenu();

  // Register all boards as commands for quick navigation
  useEffect(() => {
    const commands = allBoards.map(board => ({
      id: `nav-board-${board.id}`,
      title: board.title || 'Untitled Board',
      action: () => navigate(`/board/${board.id}`),
      section: 'Go to Board',
      keywords: ['board', 'switch', 'jump']
    }));

    commands.forEach(registerCommand);

    return () => {
      commands.forEach(c => unregisterCommand(c.id));
    };
  }, [allBoards, registerCommand, unregisterCommand, navigate]);

  // Initialize Mixpanel
  useEffect(() => {
    mixpanelService.init();
    mixpanelService.track(MixpanelEvents.APP_OPEN);
  }, []);

  useEffect(() => {
    if (session?.user) {
      mixpanelService.identify(session.user.id, {
        $name: session.user.name,
        $email: session.user.email,
        avatar: session.user.image,
      });
    }
  }, [session?.user]);

  // Implicit Anonymous Login
  useEffect(() => {
    if (!isAuthPending && !session?.user && !location.pathname.startsWith('/about')) {
      signIn.anonymous();
    }
  }, [isAuthPending, session, location.pathname]);

  const handleNewBoard = () => {
    mixpanelService.track(MixpanelEvents.NAV_NEW_BOARD);
    navigate('/board?create=true');
  };

  const handleDeleteBoard = (id: string) => {
    deleteBoard.mutate(id, {
      onSuccess: () => {
        if (allBoards.length > 1) {
          const remaining = allBoards.filter(b => b.id !== id);
          navigate(`/board/${remaining[0].id}`);
        } else {
          navigate('/board');
        }
      }
    });
  };

  return (
    <div className="flex h-screen min-w-screen bg-background w-screen ">
      <CommandMenu />
      <Routes>
        <Route path="/" element={<BoardsPage />} />
        <Route path="/about" element={<LandingPage />} />
        <Route path="/privacy" element={<PrivacyPolicy />} />

        <Route path="/boards" element={<BoardsPage />} />
        <Route path="/board" element={<BoardsPage />} />
        <Route path="/new" element={<NewBoardRedirect />} />
        <Route path="/app/integrations" element={<BoardsPage />} />
        <Route path="/test-ai" element={<TestAI />} />
        <Route path="/speech" element={<SpeechDemo />} />
        <Route path="/canvas-ai" element={<CanvasDrawDemo />} />
        <Route path="/demoLiveAPI" element={<Navigate to="/demoLiveAPI/new" replace />} />
        <Route path="/demoLiveAPI/:boardId" element={<DemoLiveBoard />} />
        <Route path="/convo/:id" element={<ConversationTest />} />
        <Route
          path="/board/:id"
          element={
            <BoardView
              allBoards={allBoards}
              onNewBoard={handleNewBoard}
              onDeleteBoard={handleDeleteBoard}
            />
          }
        />
      </Routes>
    </div>
  );
}

export function App() {
  return (
    <CommandMenuProvider>
      <AppContent />
    </CommandMenuProvider>
  );
}

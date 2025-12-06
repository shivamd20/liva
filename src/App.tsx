import { Routes, Route, useParams, useNavigate, useLocation } from 'react-router-dom';
import { BoardEditor } from './components/BoardEditor';
import { NewBoardPage } from './components/NewBoardPage';
import { LandingPage } from './components/LandingPage';
import { AuthDialog } from './components/AuthDialog';
import { MainMenu } from '@excalidraw/excalidraw';
import { Board } from './types';
import { useBoards, useBoard, useUpdateBoard, useDeleteBoard } from './hooks/useBoards';
import { useCallback } from 'react';
import { useSession } from './lib/auth-client';
import BoardsPage from './components/boards/boards-page';
import { useTheme } from 'next-themes';
import { CommandMenuProvider } from '@/lib/command-menu-context';
import { CommandMenu } from '@/components/command-menu';
import { TestAI } from './components/TestAI';

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
  const { data: board, isLoading } = useBoard(id);
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

  if (isLoading) return <div>Loading...</div>;
  if (!board) return <div>Board not found</div>;

  const handleRenameBoard = () => {
    const newTitle = window.prompt('Enter new board name:', board.title || 'Untitled');
    if (newTitle !== null) {
      mixpanelService.track(MixpanelEvents.BOARD_RENAME, { boardId: board.id, newTitle });
      handleBoardChange({ ...board, title: newTitle });
    }
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

  const menuItems = (
    <>
      <MainMenu.Item onSelect={() => navigate('/board')}>
        Return to Boards
      </MainMenu.Item>
      <MainMenu.Item onSelect={onNewBoard}>
        New Board
      </MainMenu.Item>
      <MainMenu.Item onSelect={handleRenameBoard}>
        Rename Current Board
      </MainMenu.Item>
      <MainMenu.Item onSelect={handleDuplicate}>
        Duplicate Board
      </MainMenu.Item>
      <MainMenu.Item onSelect={() => {
        mixpanelService.track(MixpanelEvents.BOARD_HISTORY_OPEN, { boardId: board.id });
        setIsHistoryOpen(true);
      }}>
        History
      </MainMenu.Item>
      <MainMenu.Item onSelect={handleSwitchTheme}>
        Switch to {theme === 'dark' ? 'light' : 'dark'} mode
      </MainMenu.Item>
      {allBoards.length > 1 && id && (
        <>
          <MainMenu.Separator />
          <MainMenu.Item
            onSelect={() => {
              if (window.confirm('Delete this board?')) {
                mixpanelService.track(MixpanelEvents.BOARD_DELETE, { boardId: id, source: 'Main Menu' });
                onDeleteBoard(id);
              }
            }}
          >
            Delete Current Board
          </MainMenu.Item>
        </>
      )}
      <MainMenu.Separator />
      <MainMenu.Group title="Boards">
        {allBoards.map(b => (
          <MainMenu.Item
            key={b.id}
            onSelect={() => navigate(`/board/${b.id}`)}
          >
            {b.title || 'Untitled board'}
            {b.id === id && ' (current)'}
          </MainMenu.Item>
        ))}
      </MainMenu.Group>

    </>
  );

  return (
    <>
      <BoardEditor board={board} onChange={handleBoardChange} menuItems={menuItems} key={id} />
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

  const handleNewBoard = () => {
    mixpanelService.track(MixpanelEvents.NAV_NEW_BOARD);
    navigate('/board/new');
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

  const isLandingPage = location.pathname === '/';

  return (
    <div className="flex h-screen min-w-screen bg-background w-screen ">
      <CommandMenu />
      <Routes>
        <Route path="/" element={<LandingPage />} />
        <Route path="/boards" element={<BoardsPage />} />
        <Route path="/board" element={<BoardsPage />} />
        <Route path="/board/new" element={<NewBoardPage />} />
        <Route path="/templates" element={<> Work in progress </>} />
        <Route path="/test-ai" element={<TestAI />} />
        <Route path="/speech" element={<SpeechDemo />} />
        <Route path="/canvas-ai" element={<CanvasDrawDemo />} />
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
      <AuthDialog
        isOpen={!isLandingPage && !isAuthPending && !session?.user}
        onOpenChange={(open) => {
          if (!open) navigate('/');
        }}
      />
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

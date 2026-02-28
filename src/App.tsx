import { Routes, Route, useParams, useNavigate, useLocation } from 'react-router-dom';
import { lazy, Suspense, useCallback, useState, useEffect, Component, type ReactNode, type ErrorInfo } from 'react';
import { Board } from './types';
import { useBoard, useUpdateBoard, useDeleteBoard, useDuplicateBoard } from './hooks/useBoards';
import { useSession, signIn } from './lib/auth-client';
import BoardsPage from './components/boards/boards-page';
import { useTheme } from 'next-themes';
import { NewBoardRedirect } from './components/NewBoardRedirect';
import { LoadingScreen } from './components/LoadingScreen';
import { BoardNotFound } from './components/BoardNotFound';
import { HistoryModal } from './components/HistoryModal';
import { boardsAPI } from './boardsConfig';
import { toast } from 'sonner';
import { Copy, Trash, History, Edit2, AlertTriangle, RefreshCcw } from 'lucide-react';
import { mixpanelService, MixpanelEvents } from './lib/mixpanel';
import * as Dialog from '@radix-ui/react-dialog';

class ErrorBoundary extends Component<{ children: ReactNode }, { hasError: boolean; error: Error | null }> {
  state = { hasError: false, error: null as Error | null };

  static getDerivedStateFromError(error: Error) {
    return { hasError: true, error };
  }

  componentDidCatch(error: Error, info: ErrorInfo) {
    console.error('[ErrorBoundary]', error, info.componentStack);
  }

  render() {
    if (this.state.hasError) {
      return (
        <div className="h-screen w-screen flex items-center justify-center bg-background p-6">
          <div className="max-w-md text-center space-y-4">
            <div className="mx-auto w-14 h-14 rounded-full bg-red-100 dark:bg-red-900/30 flex items-center justify-center">
              <AlertTriangle className="w-7 h-7 text-red-600 dark:text-red-400" />
            </div>
            <h1 className="text-xl font-semibold text-foreground">Something went wrong</h1>
            <p className="text-sm text-muted-foreground">
              An unexpected error occurred. Try refreshing the page.
            </p>
            {this.state.error && (
              <pre className="text-xs text-left bg-muted/50 rounded-lg p-3 overflow-auto max-h-32 text-muted-foreground">
                {this.state.error.message}
              </pre>
            )}
            <button
              onClick={() => { this.setState({ hasError: false, error: null }); window.location.reload(); }}
              className="inline-flex items-center gap-2 px-4 py-2 text-sm font-medium rounded-lg bg-foreground text-background hover:opacity-90 transition-opacity"
            >
              <RefreshCcw className="w-4 h-4" />
              Reload page
            </button>
          </div>
        </div>
      );
    }
    return this.props.children;
  }
}

// Lazy load heavy route components to reduce initial bundle size
const BoardEditor = lazy(() => import('./components/BoardEditor'));
const LandingPage = lazy(() => import('./components/LandingPage'));
const PrivacyPolicy = lazy(() => import('./components/PrivacyPolicy'));
const VideoDetailPage = lazy(() => import('./components/videos/VideoDetailPage'));
const ShareVideoPage = lazy(() => import('./components/videos/ShareVideoPage'));
const SystemShotsHomePage = lazy(() => import('./components/system-shots/SystemShotsHomePage'));


function BoardView({
  onNewBoard,
  onDeleteBoard
}: {
  onNewBoard: () => void;
  onDeleteBoard: (id: string) => void;
}) {
  const { id } = useParams<{ id: string }>();
  const { data: session } = useSession();
  const { data: board, isPending: isLoading } = useBoard(id);
  const updateBoard = useUpdateBoard();
  const duplicateBoard = useDuplicateBoard();
  const navigate = useNavigate();
  const [isHistoryOpen, setIsHistoryOpen] = useState(false);

  const [isRenameOpen, setIsRenameOpen] = useState(false);
  const [renameValue, setRenameValue] = useState('');
  const [isDuplicateOpen, setIsDuplicateOpen] = useState(false);
  const [duplicateValue, setDuplicateValue] = useState('');
  const [isDeleteOpen, setIsDeleteOpen] = useState(false);

  const handleBoardChange = useCallback((updated: Board) => {
    updateBoard.mutate(updated);
  }, [updateBoard]);

  useEffect(() => {
    if (board) {
      mixpanelService.track(MixpanelEvents.BOARD_OPEN, { boardId: board.id, title: board.title });
    }
  }, [board?.id]);

  const { theme, setTheme } = useTheme();

  if (!session?.user) {
    return <LoadingScreen />;
  }

  if (isLoading) return <LoadingScreen />;
  if (!board) return <BoardNotFound />;

  const handleRenameBoard = () => {
    setRenameValue(board.title || 'Untitled');
    setIsRenameOpen(true);
  };

  const handleRenameSubmit = () => {
    const trimmed = renameValue.trim();
    if (trimmed && trimmed !== board.title) {
      handleTitleChange(trimmed);
    }
    setIsRenameOpen(false);
  };

  const handleTitleChange = (newTitle: string) => {
    mixpanelService.track(MixpanelEvents.BOARD_RENAME, { boardId: board.id, newTitle });
    handleBoardChange({ ...board, title: newTitle });
  };

  const handleDuplicate = () => {
    setDuplicateValue(`${board.title} (Copy)`);
    setIsDuplicateOpen(true);
  };

  const handleDuplicateSubmit = () => {
    const title = duplicateValue.trim();
    if (!title) return;
    setIsDuplicateOpen(false);
    duplicateBoard.mutate({ board, title }, {
      onSuccess: (newBoard) => {
        if (newBoard) {
          navigate(`/board/${newBoard.id}`);
          toast.success("Board duplicated successfully");
          mixpanelService.track(MixpanelEvents.BOARD_DUPLICATE, { sourceId: board.id, newId: newBoard.id });
        }
      }
    });
  };

  const handleDeleteConfirm = () => {
    if (!id) return;
    setIsDeleteOpen(false);
    mixpanelService.track(MixpanelEvents.BOARD_DELETE, { boardId: id, source: 'Main Menu' });
    onDeleteBoard(id);
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
      handleBoardChange(updated);
      mixpanelService.track(MixpanelEvents.BOARD_SHARE_TOGGLE, { boardId: board.id, isPublic: updated.access === 'public' });
    } catch (error) {
      toast.error("Failed to toggle share settings");
    }
  };

  const handleSwitchTheme = () => {
    setTheme(theme === 'dark' ? 'light' : 'dark');
  };

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
    ...(id ? [{
      label: 'Delete Current Board',
      onClick: () => setIsDeleteOpen(true),
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
      />
      {isHistoryOpen && (
        <HistoryModal
          isOpen={isHistoryOpen}
          onClose={() => setIsHistoryOpen(false)}
          boardId={board.id}
          boardTitle={board.title}
        />
      )}

      {/* Rename Dialog */}
      <Dialog.Root open={isRenameOpen} onOpenChange={setIsRenameOpen}>
        <Dialog.Portal>
          <Dialog.Overlay className="fixed inset-0 bg-black/50 backdrop-blur-sm z-[70] animate-in fade-in duration-200" />
          <Dialog.Content className="fixed top-1/2 left-1/2 -translate-x-1/2 -translate-y-1/2 bg-background rounded-2xl shadow-xl p-6 w-full max-w-md z-[70] animate-in zoom-in-95 duration-200 border border-border">
            <Dialog.Title className="text-lg font-semibold text-foreground mb-4">Rename Board</Dialog.Title>
            <form onSubmit={(e) => { e.preventDefault(); handleRenameSubmit(); }}>
              <input
                type="text"
                value={renameValue}
                onChange={(e) => setRenameValue(e.target.value)}
                className="w-full px-4 py-2 border border-border rounded-lg bg-background text-foreground focus:ring-2 focus:ring-primary focus:border-primary outline-none transition-all"
                autoFocus
              />
              <div className="flex justify-end gap-3 mt-6">
                <button type="button" onClick={() => setIsRenameOpen(false)} className="px-4 py-2 text-sm font-medium text-muted-foreground bg-muted hover:bg-muted/80 rounded-lg transition-colors">
                  Cancel
                </button>
                <button type="submit" disabled={!renameValue.trim()} className="px-4 py-2 text-sm font-medium text-primary-foreground bg-primary hover:bg-primary/90 rounded-lg disabled:opacity-50 transition-colors">
                  Rename
                </button>
              </div>
            </form>
          </Dialog.Content>
        </Dialog.Portal>
      </Dialog.Root>

      {/* Duplicate Dialog */}
      <Dialog.Root open={isDuplicateOpen} onOpenChange={setIsDuplicateOpen}>
        <Dialog.Portal>
          <Dialog.Overlay className="fixed inset-0 bg-black/50 backdrop-blur-sm z-[70] animate-in fade-in duration-200" />
          <Dialog.Content className="fixed top-1/2 left-1/2 -translate-x-1/2 -translate-y-1/2 bg-background rounded-2xl shadow-xl p-6 w-full max-w-md z-[70] animate-in zoom-in-95 duration-200 border border-border">
            <Dialog.Title className="text-lg font-semibold text-foreground mb-4">Duplicate Board</Dialog.Title>
            <form onSubmit={(e) => { e.preventDefault(); handleDuplicateSubmit(); }}>
              <label className="block text-sm font-medium text-muted-foreground mb-1">New board name</label>
              <input
                type="text"
                value={duplicateValue}
                onChange={(e) => setDuplicateValue(e.target.value)}
                className="w-full px-4 py-2 border border-border rounded-lg bg-background text-foreground focus:ring-2 focus:ring-primary focus:border-primary outline-none transition-all"
                autoFocus
              />
              <div className="flex justify-end gap-3 mt-6">
                <button type="button" onClick={() => setIsDuplicateOpen(false)} className="px-4 py-2 text-sm font-medium text-muted-foreground bg-muted hover:bg-muted/80 rounded-lg transition-colors">
                  Cancel
                </button>
                <button type="submit" disabled={!duplicateValue.trim() || duplicateBoard.isPending} className="px-4 py-2 text-sm font-medium text-primary-foreground bg-primary hover:bg-primary/90 rounded-lg disabled:opacity-50 transition-colors">
                  {duplicateBoard.isPending ? 'Duplicating...' : 'Duplicate'}
                </button>
              </div>
            </form>
          </Dialog.Content>
        </Dialog.Portal>
      </Dialog.Root>

      {/* Delete Confirmation Dialog */}
      <Dialog.Root open={isDeleteOpen} onOpenChange={setIsDeleteOpen}>
        <Dialog.Portal>
          <Dialog.Overlay className="fixed inset-0 bg-black/50 backdrop-blur-sm z-[70] animate-in fade-in duration-200" />
          <Dialog.Content className="fixed top-1/2 left-1/2 -translate-x-1/2 -translate-y-1/2 bg-background rounded-2xl shadow-xl p-6 w-full max-w-md z-[70] animate-in zoom-in-95 duration-200 border border-border">
            <div className="flex flex-col items-center text-center">
              <div className="w-14 h-14 rounded-full bg-red-100 dark:bg-red-900/30 flex items-center justify-center mb-4">
                <AlertTriangle className="w-7 h-7 text-red-600 dark:text-red-400" />
              </div>
              <Dialog.Title className="text-lg font-semibold text-foreground mb-2">Delete Board?</Dialog.Title>
              <Dialog.Description className="text-sm text-muted-foreground mb-6">
                Are you sure you want to delete <span className="font-semibold text-foreground">"{board.title}"</span>? This action cannot be undone.
              </Dialog.Description>
              <div className="flex gap-3 w-full">
                <button onClick={() => setIsDeleteOpen(false)} className="flex-1 px-4 py-2.5 text-sm font-medium text-muted-foreground bg-muted hover:bg-muted/80 rounded-lg transition-colors">
                  Cancel
                </button>
                <button onClick={handleDeleteConfirm} className="flex-1 px-4 py-2.5 text-sm font-medium text-white bg-red-600 hover:bg-red-700 rounded-lg transition-colors">
                  Delete Board
                </button>
              </div>
            </div>
          </Dialog.Content>
        </Dialog.Portal>
      </Dialog.Root>
    </>
  );
}

function AppContent() {
  const deleteBoard = useDeleteBoard();
  const navigate = useNavigate();
  const location = useLocation();
  const { data: session, isPending: isAuthPending } = useSession();

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
    navigate('/board');
    let cancelled = false;
    const timeout = setTimeout(() => {
      if (!cancelled) {
        deleteBoard.mutate(id);
      }
    }, 5000);

    toast('Board deleted', {
      action: {
        label: 'Undo',
        onClick: () => {
          cancelled = true;
          clearTimeout(timeout);
          toast.success('Board restored');
        }
      },
      duration: 5000,
    });
  };

  return (
    <div className=" h-screen  min-w-screen bg-background w-screen ">
      <Suspense fallback={<LoadingScreen />}>
        <Routes>
          <Route path="/" element={<BoardsPage />} />
          <Route path="/about" element={<LandingPage />} />
          <Route path="/privacy" element={<PrivacyPolicy />} />

          <Route path="/boards" element={<BoardsPage />} />
          <Route path="/board" element={<BoardsPage />} />
          <Route path="/new" element={<NewBoardRedirect />} />
          <Route path="/app/integrations" element={<BoardsPage />} />
          <Route path="/app/videos" element={<BoardsPage />} />
          <Route path="/app/videos/:videoId" element={<VideoDetailPage />} />
          <Route path="/share/:videoId" element={<ShareVideoPage />} />
          <Route path="/app/system-shots" element={<BoardsPage />} />

          <Route path="/app/system-shots/home" element={<SystemShotsHomePage />} />
          <Route
            path="/board/:id"
            element={
              <BoardView
                onNewBoard={handleNewBoard}
                onDeleteBoard={handleDeleteBoard}
              />
            }
          />
        </Routes>
      </Suspense>
    </div>
  );
}

export function App() {
  return (
    <ErrorBoundary>
      <AppContent />
    </ErrorBoundary>
  );
}

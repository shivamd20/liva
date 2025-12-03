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
  const navigate = useNavigate();

  const handleBoardChange = useCallback((updated: Board) => {
    updateBoard.mutate(updated);
  }, [updateBoard]);

  if (!session?.user) {
    return <div className="h-screen w-full bg-gray-50" />; // Placeholder behind auth dialog
  }

  if (isLoading) return <div>Loading...</div>;
  if (!board) return <div>Board not found</div>;

  const handleRenameBoard = () => {
    const newTitle = window.prompt('Enter new board name:', board.title || 'Untitled');
    if (newTitle !== null) {
      handleBoardChange({ ...board, title: newTitle });
    }
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
      {allBoards.length > 1 && id && (
        <>
          <MainMenu.Separator />
          <MainMenu.Item
            onSelect={() => {
              if (window.confirm('Delete this board?')) {
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

  return <BoardEditor board={board} onChange={handleBoardChange} menuItems={menuItems} key={id} />;
}

export function App() {
  const { data: allBoards = [] } = useBoards();
  const deleteBoard = useDeleteBoard();
  const navigate = useNavigate();
  const location = useLocation();
  const { data: session, isPending: isAuthPending } = useSession();

  const handleNewBoard = () => {
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
      <Routes>
        <Route path="/" element={<LandingPage />} />
        <Route path="/boards" element={<BoardsPage />} />
        <Route path="/board" element={<BoardsPage />} />
        <Route path="/board/new" element={<NewBoardPage />} />
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

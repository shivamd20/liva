import { useState, useEffect } from 'react';
import { useNavigate } from 'react-router-dom';
import { useBoards, useCreateBoard, useUpdateBoard, useDeleteBoard, useDuplicateBoard } from '../hooks/useBoards';
import { Plus, File, Clock, MoreHorizontal, LayoutGrid, Pencil, Trash2, X, Copy, AlertTriangle, LogOut } from 'lucide-react';
import { Board } from '../types';
import * as DropdownMenu from '@radix-ui/react-dropdown-menu';
import * as Dialog from '@radix-ui/react-dialog';
import { exportToBlob } from "@excalidraw/excalidraw";
import { signOut, useSession } from '../lib/auth-client';

export function HomeBoard() {
    const { data: boards = [], isLoading } = useBoards();
    const createBoard = useCreateBoard();
    const updateBoard = useUpdateBoard();
    const deleteBoard = useDeleteBoard();
    const duplicateBoard = useDuplicateBoard();
    const navigate = useNavigate();
    const [isCreateModalOpen, setIsCreateModalOpen] = useState(false);
    const [isDeleteModalOpen, setIsDeleteModalOpen] = useState(false);
    const [isRenameModalOpen, setIsRenameModalOpen] = useState(false);
    const [isDuplicateModalOpen, setIsDuplicateModalOpen] = useState(false);
    const [boardToDelete, setBoardToDelete] = useState<{ id: string; title: string } | null>(null);
    const [boardToRename, setBoardToRename] = useState<Board | null>(null);
    const [boardToDuplicate, setBoardToDuplicate] = useState<Board | null>(null);
    const [newBoardTitle, setNewBoardTitle] = useState('');
    const [renameTitle, setRenameTitle] = useState('');
    const [duplicateTitle, setDuplicateTitle] = useState('');
    const { data: session, isPending: isAuthPending } = useSession();

    const handleCreateSubmit = (e: React.FormEvent) => {
        e.preventDefault();
        if (!newBoardTitle.trim()) return;

        createBoard.mutate({ title: newBoardTitle.trim() }, {
            onSuccess: (newBoard) => {
                setIsCreateModalOpen(false);
                setNewBoardTitle('');
                navigate(`/board/${newBoard.id}`);
            }
        });
    };

    const handleRenameClick = (board: Board) => {
        setBoardToRename(board);
        setRenameTitle(board.title || 'Untitled');
        setIsRenameModalOpen(true);
    };

    const handleRenameSubmit = (e: React.FormEvent) => {
        e.preventDefault();
        if (!renameTitle.trim() || !boardToRename) return;

        updateBoard.mutate({ ...boardToRename, title: renameTitle.trim() }, {
            onSuccess: () => {
                setIsRenameModalOpen(false);
                setBoardToRename(null);
                setRenameTitle('');
            }
        });
    };

    const handleRenameCancel = () => {
        setIsRenameModalOpen(false);
        setBoardToRename(null);
        setRenameTitle('');
    };

    const handleDeleteClick = (board: Board) => {
        setBoardToDelete({ id: board.id, title: board.title });
        setIsDeleteModalOpen(true);
    };

    const handleDeleteConfirm = () => {
        if (boardToDelete) {
            deleteBoard.mutate(boardToDelete.id);
            setIsDeleteModalOpen(false);
            setBoardToDelete(null);
        }
    };

    const handleDeleteCancel = () => {
        setIsDeleteModalOpen(false);
        setBoardToDelete(null);
    };

    const handleDuplicateClick = (board: Board) => {
        setBoardToDuplicate(board);
        setDuplicateTitle(`${board.title} (Copy)`);
        setIsDuplicateModalOpen(true);
    };

    const handleDuplicateSubmit = (e: React.FormEvent) => {
        e.preventDefault();
        if (!duplicateTitle.trim() || !boardToDuplicate) return;

        duplicateBoard.mutate({ board: boardToDuplicate, title: duplicateTitle.trim() }, {
            onSuccess: (newBoard) => {
                if (newBoard) {
                    setIsDuplicateModalOpen(false);
                    setBoardToDuplicate(null);
                    setDuplicateTitle('');
                 
                }
            }
        });
    };

    const handleDuplicateCancel = () => {
        setIsDuplicateModalOpen(false);
        setBoardToDuplicate(null);
        setDuplicateTitle('');
    };
    // Sort boards by last updated (most recent first)
    const sortedBoards = [...boards].sort((a, b) => {
        const dateA = a.updatedAt || a.createdAt || 0;
        const dateB = b.updatedAt || b.createdAt || 0;
        return dateB - dateA;
    });

    if (isLoading) {
        return (
            <div className="flex w-screen items-center justify-center h-screen bg-gray-50">
                <div className="animate-pulse flex flex-col items-center">
                    <div className="h-8 w-8 bg-indigo-100 rounded-full mb-4"></div>
                    <div className="h-4 w-32 bg-gray-200 rounded"></div>
                </div>
            </div>
        );
    }

    return (
        <div className="min-h-screen min-w-screen bg-gray-50">
            {/* Header */}
            <header className="bg-gradient-to-r from-[#3B82F6] to-[#06B6D4] px-4 sm:px-6 lg:px-8 py-4 sticky top-0 z-10 shadow-lg">
                <div className="max-w-7xl mx-auto flex items-center justify-between">
                    <div className="flex items-center gap-3">
                        <div className="bg-white/20 backdrop-blur-sm p-2 rounded-lg shadow-sm">
                            <LayoutGrid className="w-5 h-5 text-white" />
                        </div>
                        <h1 className="text-xl font-bold text-white tracking-tight">Liva </h1>
                    </div>
                    <div className="flex items-center gap-4">
                         {/* User Profile / Sign In */}
                         {isAuthPending ? (
                            <div className="w-8 h-8 bg-gray-100 rounded-full animate-pulse" />
                         ) : session?.user ? (
                            <DropdownMenu.Root>
                                <DropdownMenu.Trigger asChild>
                                    <button className="w-8 h-8 rounded-full bg-white/20 backdrop-blur-sm flex items-center justify-center text-white font-bold text-xs border border-white/30 overflow-hidden hover:ring-2 hover:ring-white/50 transition-all cursor-pointer focus:outline-none">
                                        {session.user.image ? (
                                            <img src={session.user.image} alt={session.user.name || 'User'} className="w-full h-full object-cover" />
                                        ) : (
                                            session.user.name ? session.user.name.charAt(0).toUpperCase() : 'U'
                                        )}
                                    </button>
                                </DropdownMenu.Trigger>

                                <DropdownMenu.Portal>
                                    <DropdownMenu.Content 
                                        className="min-w-[160px] bg-white rounded-lg shadow-lg border border-gray-100 p-1 z-50 animate-in fade-in zoom-in-95 duration-100"
                                        sideOffset={5}
                                        align="end"
                                    >
                                        <div className="px-2 py-2 text-xs text-gray-500 font-medium border-b border-gray-100 mb-1">
                                            {session.user.name || 'User'}
                                        </div>
                                        <DropdownMenu.Item 
                                            onSelect={async () => {
                                                await signOut();
                                                navigate('/');
                                            }}
                                            className="flex items-center gap-2 px-2 py-2 text-sm text-gray-700 hover:bg-gradient-to-r hover:from-[#3B82F6]/10 hover:to-[#06B6D4]/10 hover:text-[#3B82F6] rounded-md cursor-pointer outline-none transition-all"
                                        >
                                            <LogOut className="w-4 h-4" />
                                            Sign Out
                                        </DropdownMenu.Item>
                                    </DropdownMenu.Content>
                                </DropdownMenu.Portal>
                            </DropdownMenu.Root>
                         ) : null}
                    </div>
                </div>
            </header>

            {/* Main Content */}
            <main className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 py-8">
                
                {/* Recent Boards Section */}
                <div className="mb-8">
                    <div className="flex items-center justify-between mb-6">
                        <h2 className="text-sm font-semibold text-gray-500 uppercase tracking-wider">Your Boards</h2>
                        <span className="text-xs text-gray-400">{boards.length} boards</span>
                    </div>
                    
                    <div className="grid grid-cols-1 sm:grid-cols-2 md:grid-cols-3 lg:grid-cols-4 xl:grid-cols-5 gap-6">
                        {/* Create New Card */}
                        <Dialog.Root open={isCreateModalOpen} onOpenChange={setIsCreateModalOpen}>
                            <Dialog.Trigger asChild>
                                <button 
                                    className="group relative aspect-[4/3] flex flex-col bg-white rounded-xl border-2 border-dashed border-gray-300 hover:border-transparent hover:bg-gradient-to-br hover:from-[#3B82F6] hover:to-[#06B6D4] transition-all duration-200 cursor-pointer text-left overflow-hidden focus:outline-none focus:ring-2 focus:ring-offset-2 focus:ring-[#3B82F6]"
                                >
                                    <div className="flex-1 flex items-center justify-center">
                                        <div className="w-12 h-12 rounded-full bg-gray-100 group-hover:bg-white flex items-center justify-center transition-colors shadow-sm group-hover:shadow-md group-hover:scale-110 duration-300">
                                            <Plus className="w-6 h-6 text-gray-400 group-hover:text-[#3B82F6] transition-colors" />
                                        </div>
                                    </div>
                                    <div className="px-4 py-3 border-t border-transparent group-hover:border-white/30 bg-gray-50 group-hover:bg-white/20 transition-colors">
                                        <span className="block text-sm font-medium text-gray-900 group-hover:text-white">Create New Board</span>
                                    </div>
                                </button>
                            </Dialog.Trigger>
                            <Dialog.Portal>
                                <Dialog.Overlay className="fixed inset-0 bg-black/50 backdrop-blur-sm z-40 animate-in fade-in duration-200" />
                                <Dialog.Content className="fixed top-1/2 left-1/2 -translate-x-1/2 -translate-y-1/2 bg-white rounded-2xl shadow-xl p-6 w-full max-w-md z-50 animate-in zoom-in-95 duration-200 border border-gray-100">
                                    <div className="flex justify-between items-center mb-4">
                                        <Dialog.Title className="text-xl font-bold text-gray-900">Create New Board</Dialog.Title>
                                        <Dialog.Close asChild>
                                            <button className="text-gray-400 hover:text-gray-600 p-1 rounded-full hover:bg-gray-100 transition-colors">
                                                <X className="w-5 h-5" />
                                            </button>
                                        </Dialog.Close>
                                    </div>
                                    
                                    <form onSubmit={handleCreateSubmit} className="space-y-4">
                                        <div>
                                            <label htmlFor="boardTitle" className="block text-sm font-medium text-gray-700 mb-1">
                                                Board Title
                                            </label>
                                            <input
                                                id="boardTitle"
                                                type="text"
                                                value={newBoardTitle}
                                                onChange={(e) => setNewBoardTitle(e.target.value)}
                                                placeholder="e.g., Project Roadmap"
                                                className="w-full px-4 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-indigo-500 focus:border-indigo-500 outline-none transition-all"
                                                autoFocus
                                            />
                                        </div>
                                        
                                        <div className="flex justify-end gap-3 mt-6">
                                            <Dialog.Close asChild>
                                                <button 
                                                    type="button"
                                                    className="px-4 py-2 text-sm font-medium text-gray-700 bg-gray-100 hover:bg-gray-200 rounded-lg transition-colors"
                                                >
                                                    Cancel
                                                </button>
                                            </Dialog.Close>
                                            <button 
                                                type="submit"
                                                disabled={!newBoardTitle.trim() || createBoard.isPending}
                                                className="px-4 py-2 text-sm font-medium text-white bg-gradient-to-r from-[#3B82F6] to-[#06B6D4] hover:from-[#2563EB] hover:to-[#0891B2] rounded-lg disabled:opacity-50 disabled:cursor-not-allowed transition-all flex items-center gap-2 shadow-md hover:shadow-lg"
                                            >
                                                {createBoard.isPending ? 'Creating...' : 'Create Board'}
                                            </button>
                                        </div>
                                    </form>
                                </Dialog.Content>
                            </Dialog.Portal>
                        </Dialog.Root>

                        {/* Delete Confirmation Modal */}
                        <Dialog.Root open={isDeleteModalOpen} onOpenChange={setIsDeleteModalOpen}>
                            <Dialog.Portal>
                                <Dialog.Overlay className="fixed inset-0 bg-black/50 backdrop-blur-sm z-40 animate-in fade-in duration-200" />
                                <Dialog.Content className="fixed top-1/2 left-1/2 -translate-x-1/2 -translate-y-1/2 bg-white rounded-2xl shadow-xl p-6 w-full max-w-md z-50 animate-in zoom-in-95 duration-200 border border-gray-100">
                                    <div className="flex flex-col items-center text-center">
                                        {/* Warning Icon */}
                                        <div className="w-16 h-16 rounded-full bg-red-100 flex items-center justify-center mb-4">
                                            <AlertTriangle className="w-8 h-8 text-red-600" />
                                        </div>
                                        
                                        {/* Title */}
                                        <Dialog.Title className="text-xl font-bold text-gray-900 mb-2">
                                            Delete Board?
                                        </Dialog.Title>
                                        
                                        {/* Description */}
                                        <Dialog.Description className="text-sm text-gray-600 mb-6">
                                            Are you sure you want to delete <span className="font-semibold text-gray-900">"{boardToDelete?.title}"</span>? This action cannot be undone and all board content will be permanently lost.
                                        </Dialog.Description>
                                        
                                        {/* Action Buttons */}
                                        <div className="flex gap-3 w-full">
                                            <button 
                                                onClick={handleDeleteCancel}
                                                className="flex-1 px-4 py-2.5 text-sm font-medium text-gray-700 bg-gray-100 hover:bg-gray-200 rounded-lg transition-colors"
                                            >
                                                Cancel
                                            </button>
                                            <button 
                                                onClick={handleDeleteConfirm}
                                                disabled={deleteBoard.isPending}
                                                className="flex-1 px-4 py-2.5 text-sm font-medium text-white bg-red-600 hover:bg-red-700 rounded-lg disabled:opacity-50 disabled:cursor-not-allowed transition-colors"
                                            >
                                                {deleteBoard.isPending ? 'Deleting...' : 'Delete Board'}
                                            </button>
                                        </div>
                                    </div>
                                </Dialog.Content>
                            </Dialog.Portal>
                        </Dialog.Root>

                        {/* Rename Board Modal */}
                        <Dialog.Root open={isRenameModalOpen} onOpenChange={setIsRenameModalOpen}>
                            <Dialog.Portal>
                                <Dialog.Overlay className="fixed inset-0 bg-black/50 backdrop-blur-sm z-40 animate-in fade-in duration-200" />
                                <Dialog.Content className="fixed top-1/2 left-1/2 -translate-x-1/2 -translate-y-1/2 bg-white rounded-2xl shadow-xl p-6 w-full max-w-md z-50 animate-in zoom-in-95 duration-200 border border-gray-100">
                                    <div className="flex justify-between items-center mb-4">
                                        <Dialog.Title className="text-xl font-bold text-gray-900">Rename Board</Dialog.Title>
                                        <button 
                                            onClick={handleRenameCancel}
                                            className="text-gray-400 hover:text-gray-600 p-1 rounded-full hover:bg-gray-100 transition-colors"
                                        >
                                            <X className="w-5 h-5" />
                                        </button>
                                    </div>
                                    
                                    <form onSubmit={handleRenameSubmit} className="space-y-4">
                                        <div>
                                            <label htmlFor="renameTitle" className="block text-sm font-medium text-gray-700 mb-1">
                                                Board Title
                                            </label>
                                            <input
                                                id="renameTitle"
                                                type="text"
                                                value={renameTitle}
                                                onChange={(e) => setRenameTitle(e.target.value)}
                                                placeholder="Enter board name"
                                                className="w-full px-4 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-indigo-500 focus:border-indigo-500 outline-none transition-all"
                                                autoFocus
                                            />
                                        </div>
                                        
                                        <div className="flex justify-end gap-3 mt-6">
                                            <button 
                                                type="button"
                                                onClick={handleRenameCancel}
                                                className="px-4 py-2 text-sm font-medium text-gray-700 bg-gray-100 hover:bg-gray-200 rounded-lg transition-colors"
                                            >
                                                Cancel
                                            </button>
                                            <button 
                                                type="submit"
                                                disabled={!renameTitle.trim() || updateBoard.isPending}
                                                className="px-4 py-2 text-sm font-medium text-white bg-gradient-to-r from-[#3B82F6] to-[#06B6D4] hover:from-[#2563EB] hover:to-[#0891B2] rounded-lg disabled:opacity-50 disabled:cursor-not-allowed transition-all shadow-md hover:shadow-lg"
                                            >
                                                {updateBoard.isPending ? 'Renaming...' : 'Rename Board'}
                                            </button>
                                        </div>
                                    </form>
                                </Dialog.Content>
                            </Dialog.Portal>
                        </Dialog.Root>

                        {/* Duplicate Board Modal */}
                        <Dialog.Root open={isDuplicateModalOpen} onOpenChange={setIsDuplicateModalOpen}>
                            <Dialog.Portal>
                                <Dialog.Overlay className="fixed inset-0 bg-black/50 backdrop-blur-sm z-40 animate-in fade-in duration-200" />
                                <Dialog.Content className="fixed top-1/2 left-1/2 -translate-x-1/2 -translate-y-1/2 bg-white rounded-2xl shadow-xl p-6 w-full max-w-md z-50 animate-in zoom-in-95 duration-200 border border-gray-100">
                                    <div className="flex justify-between items-center mb-4">
                                        <Dialog.Title className="text-xl font-bold text-gray-900">Duplicate Board</Dialog.Title>
                                        <button 
                                            onClick={handleDuplicateCancel}
                                            className="text-gray-400 hover:text-gray-600 p-1 rounded-full hover:bg-gray-100 transition-colors"
                                        >
                                            <X className="w-5 h-5" />
                                        </button>
                                    </div>
                                    
                                    <Dialog.Description className="text-sm text-gray-600 mb-4">
                                        Creating a copy of <span className="font-semibold text-gray-900">"{boardToDuplicate?.title}"</span>
                                    </Dialog.Description>
                                    
                                    <form onSubmit={handleDuplicateSubmit} className="space-y-4">
                                        <div>
                                            <label htmlFor="duplicateTitle" className="block text-sm font-medium text-gray-700 mb-1">
                                                New Board Title
                                            </label>
                                            <input
                                                id="duplicateTitle"
                                                type="text"
                                                value={duplicateTitle}
                                                onChange={(e) => setDuplicateTitle(e.target.value)}
                                                placeholder="Enter name for duplicated board"
                                                className="w-full px-4 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-indigo-500 focus:border-indigo-500 outline-none transition-all"
                                                autoFocus
                                            />
                                        </div>
                                        
                                        <div className="flex justify-end gap-3 mt-6">
                                            <button 
                                                type="button"
                                                onClick={handleDuplicateCancel}
                                                className="px-4 py-2 text-sm font-medium text-gray-700 bg-gray-100 hover:bg-gray-200 rounded-lg transition-colors"
                                            >
                                                Cancel
                                            </button>
                                            <button 
                                                type="submit"
                                                disabled={!duplicateTitle.trim() || duplicateBoard.isPending}
                                                className="px-4 py-2 text-sm font-medium text-white bg-gradient-to-r from-[#3B82F6] to-[#06B6D4] hover:from-[#2563EB] hover:to-[#0891B2] rounded-lg disabled:opacity-50 disabled:cursor-not-allowed transition-all flex items-center gap-2 shadow-md hover:shadow-lg"
                                            >
                                                {duplicateBoard.isPending ? (
                                                    <>Duplicating...</>
                                                ) : (
                                                    <>
                                                        <Copy className="w-4 h-4" />
                                                        Duplicate Board
                                                    </>
                                                )}
                                            </button>
                                        </div>
                                    </form>
                                </Dialog.Content>
                            </Dialog.Portal>
                        </Dialog.Root>

                        {/* Board Cards */}
                        {sortedBoards.map((board) => (
                            <BoardCard 
                                key={board.id} 
                                board={board} 
                                onClick={() => navigate(`/board/${board.id}`)}
                                onRename={() => handleRenameClick(board)}
                                onDelete={() => handleDeleteClick(board)}
                                onDuplicate={() => handleDuplicateClick(board)}
                            />
                        ))}
                    </div>
                </div>
            </main>
        </div>
    );
}

function BoardThumbnail({ elements }: { elements?: any[] }) {
    const [thumbnail, setThumbnail] = useState<string | null>(null);
    const [loading, setLoading] = useState(true);

    useEffect(() => {
        let isMounted = true;
        
        const generateThumbnail = async () => {
            if (!elements || elements.length === 0) {
                if (isMounted) {
                    setThumbnail(null);
                    setLoading(false);
                }
                return;
            }

            try {
                const blob = await exportToBlob({
                    elements: elements,
                    appState: {
                        exportWithDarkMode: false,
                    },
                    files: {},
                    mimeType: "image/png",
                    quality: 0.5,
                });

                if (isMounted && blob) {
                    const url = URL.createObjectURL(blob);
                    setThumbnail(url);
                }
            } catch (error) {
                console.error("Failed to generate thumbnail", error);
            } finally {
                if (isMounted) setLoading(false);
            }
        };

        generateThumbnail();

        return () => {
            isMounted = false;
            if (thumbnail) URL.revokeObjectURL(thumbnail);
        };
    }, [elements]);

    if (loading) {
        return (
            <div className="w-full h-full flex items-center justify-center bg-gray-50">
                <div className="w-6 h-6 border-2 border-[#06B6D4]/30 border-t-[#3B82F6] rounded-full animate-spin"></div>
            </div>
        );
    }

    if (!thumbnail) {
        return (
            <div className="w-full h-full flex items-center justify-center bg-gray-50 group-hover:bg-white transition-colors">
                 <div className="absolute inset-0 opacity-[0.03] bg-[radial-gradient(#3B82F6_1px,transparent_1px)] [background-size:16px_16px]" />
                 <File className="w-10 h-10 text-gray-300 group-hover:text-[#3B82F6] transition-all duration-300 group-hover:scale-110 relative z-10" />
            </div>
        );
    }

    return (
        <div className="w-full h-full flex items-center justify-center bg-white overflow-hidden">
             <img 
                src={thumbnail} 
                alt="Board thumbnail" 
                className="w-full h-full object-contain opacity-90 group-hover:opacity-100 transition-opacity duration-300 hover:scale-105"
             />
        </div>
    );
}

function BoardCard({ board, onClick, onRename, onDelete, onDuplicate }: { board: Board; onClick: () => void; onRename: () => void; onDelete: () => void; onDuplicate: () => void }) {
    // Format date
    const formatDate = (timestamp: number) => {
        if (!timestamp) return '';
        return new Intl.DateTimeFormat('en-US', { 
            month: 'short', 
            day: 'numeric',
            year: new Date(timestamp).getFullYear() !== new Date().getFullYear() ? 'numeric' : undefined
        }).format(new Date(timestamp));
    };

    return (
        <div 
            onClick={onClick}
            className="group relative bg-white rounded-xl border border-gray-200 shadow-sm hover:shadow-xl hover:border-transparent hover:ring-2 hover:ring-[#3B82F6] transition-all duration-200 cursor-pointer flex flex-col aspect-[4/3] overflow-hidden"
        >
            {/* Thumbnail Placeholder */}
            <div className="flex-1 relative overflow-hidden">
                <BoardThumbnail elements={board.excalidrawElements} />
            </div>

            {/* Footer Info */}
            <div className="px-4 py-3 border-t border-gray-100 bg-white relative z-10">
                <div className="flex justify-between items-start">
                    <h3 className="text-sm font-semibold text-gray-900 truncate mb-1 flex-1" title={board.title}>
                        {board.title || 'Untitled'}
                    </h3>
                </div>
                <div className="flex items-center justify-between text-xs text-gray-500 mt-1">
                    <div className="flex items-center gap-1">
                        <Clock className="w-3 h-3" />
                        <span>{formatDate(board.updatedAt || board.createdAt)}</span>
                    </div>
                    
                    <DropdownMenu.Root>
                        <DropdownMenu.Trigger asChild>
                            <button 
                                onClick={(e) => e.stopPropagation()}
                                className="p-1 hover:bg-gray-100 rounded-full opacity-0 group-hover:opacity-100 transition-opacity -mr-1 focus:opacity-100 focus:outline-none"
                            >
                                <MoreHorizontal className="w-4 h-4 text-gray-500" />
                            </button>
                        </DropdownMenu.Trigger>

                        <DropdownMenu.Portal>
                            <DropdownMenu.Content 
                                className="min-w-[160px] bg-white rounded-lg shadow-lg border border-gray-100 p-1 z-50 animate-in fade-in zoom-in-95 duration-100"
                                sideOffset={5}
                                align="end"
                                onClick={(e) => e.stopPropagation()}
                            >
                                
                                <DropdownMenu.Item 
                                    onSelect={onRename}
                                    className="flex items-center gap-2 px-2 py-2 text-sm text-gray-700 hover:bg-gradient-to-r hover:from-[#3B82F6]/10 hover:to-[#06B6D4]/10 hover:text-[#3B82F6] rounded-md cursor-pointer outline-none transition-all"
                                >
                                    <Pencil className="w-4 h-4" />
                                    Rename
                                </DropdownMenu.Item>
                                  <DropdownMenu.Item 
                                    onSelect={onDuplicate}
                                    className="flex items-center gap-2 px-2 py-2 text-sm text-gray-700 hover:bg-gradient-to-r hover:from-[#3B82F6]/10 hover:to-[#06B6D4]/10 hover:text-[#3B82F6] rounded-md cursor-pointer outline-none transition-all"
                                >
                                    <Copy className="w-4 h-4" />
                                   Duplicate
                                </DropdownMenu.Item>
                                <DropdownMenu.Item 
                                    onSelect={onDelete}
                                    className="flex items-center gap-2 px-2 py-2 text-sm text-red-600 hover:bg-red-50 rounded-md cursor-pointer outline-none"
                                >
                                    <Trash2 className="w-4 h-4" />
                                    Delete
                                </DropdownMenu.Item>
                            </DropdownMenu.Content>
                        </DropdownMenu.Portal>
                    </DropdownMenu.Root>
                </div>
            </div>
        </div>
    );
}

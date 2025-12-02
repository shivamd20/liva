
import { useState, useRef, useEffect } from 'react';
import * as Dialog from '@radix-ui/react-dialog';
import { X, RotateCcw, Copy, Clock, Loader2 } from 'lucide-react';
import { useHistory, useDuplicateBoard, useRevertBoard } from '../hooks/useBoards';
import { exportToBlob } from "@excalidraw/excalidraw";
import { Board } from '../types';

interface HistoryModalProps {
    isOpen: boolean;
    onClose: () => void;
    boardId: string;
    boardTitle: string;
}

export function HistoryModal({ isOpen, onClose, boardId, boardTitle }: HistoryModalProps) {
    const {
        data,
        fetchNextPage,
        hasNextPage,
        isFetchingNextPage,
        isLoading
    } = useHistory(isOpen ? boardId : undefined);

    const duplicateBoard = useDuplicateBoard();
    const revertBoard = useRevertBoard();

    // Flatten pages into a single list of items
    const historyItems = data?.pages.flatMap(page => page.items) || [];

    // Infinite scroll observer
    const loadMoreRef = useRef<HTMLDivElement>(null);

    useEffect(() => {
        const observer = new IntersectionObserver(
            (entries) => {
                if (entries[0].isIntersecting && hasNextPage && !isFetchingNextPage) {
                    fetchNextPage();
                }
            },
            { threshold: 0.5 }
        );

        if (loadMoreRef.current) {
            observer.observe(loadMoreRef.current);
        }

        return () => observer.disconnect();
    }, [hasNextPage, isFetchingNextPage, fetchNextPage]);

    const handleRevert = (version: number) => {
        if (confirm(`Are you sure you want to revert to version ${version}? Current changes will be overwritten.`)) {
            revertBoard.mutate({ id: boardId, version }, {
                onSuccess: () => {
                    onClose();
                }
            });
        }
    };

    const handleFork = (item: any) => {
        // Create a temporary board object from the history item
        const tempBoard: Board = {
            id: 'temp',
            title: item.title,
            content: '', // Not used for duplication in this context usually, but required by type
            excalidrawElements: item.excalidrawElements,
            createdAt: item.timestamp,
            updatedAt: item.timestamp,
            userId: '', // Placeholder
            access: 'private'
        };

        duplicateBoard.mutate({
            board: tempBoard,
            title: `${item.title} (v${item.version})`
        }, {
            onSuccess: () => {
                onClose();
                // Optionally navigate to the new board, but for now just close
            }
        });
    };

    return (
        <Dialog.Root open={isOpen} onOpenChange={(open) => !open && onClose()}>
            <Dialog.Portal>
                <Dialog.Overlay className="fixed inset-0 bg-black/50 backdrop-blur-sm z-40 animate-in fade-in duration-200" />
                <Dialog.Content className="fixed top-1/2 left-1/2 -translate-x-1/2 -translate-y-1/2 bg-white rounded-2xl shadow-xl w-full max-w-5xl h-[80vh] z-50 animate-in zoom-in-95 duration-200 border border-gray-100 flex flex-col">

                    {/* Header */}
                    <div className="flex justify-between items-center p-6 border-b border-gray-100">
                        <div>
                            <Dialog.Title className="text-xl font-bold text-gray-900 flex items-center gap-2">
                                <Clock className="w-5 h-5 text-gray-500" />
                                Version History
                            </Dialog.Title>
                            <Dialog.Description className="text-sm text-gray-500 mt-1">
                                {boardTitle}
                            </Dialog.Description>
                        </div>
                        <button
                            onClick={onClose}
                            className="text-gray-400 hover:text-gray-600 p-1 rounded-full hover:bg-gray-100 transition-colors"
                        >
                            <X className="w-5 h-5" />
                        </button>
                    </div>

                    {/* Content */}
                    <div className="flex-1 overflow-y-auto p-6 bg-gray-50">
                        {isLoading ? (
                            <div className="flex items-center justify-center h-full">
                                <Loader2 className="w-8 h-8 text-indigo-500 animate-spin" />
                            </div>
                        ) : historyItems.length === 0 ? (
                            <div className="flex flex-col items-center justify-center h-full text-gray-500">
                                <Clock className="w-12 h-12 mb-2 opacity-20" />
                                <p>No history available</p>
                            </div>
                        ) : (
                            <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-6">
                                {historyItems.map((item) => (
                                    <HistoryCard
                                        key={item.version}
                                        item={item}
                                        onRevert={() => handleRevert(item.version)}
                                        onFork={() => handleFork(item)}
                                        isReverting={revertBoard.isPending}
                                        isForking={duplicateBoard.isPending}
                                    />
                                ))}
                            </div>
                        )}

                        {/* Infinite Scroll Loader */}
                        <div ref={loadMoreRef} className="py-4 flex justify-center">
                            {isFetchingNextPage && (
                                <Loader2 className="w-6 h-6 text-gray-400 animate-spin" />
                            )}
                        </div>
                    </div>
                </Dialog.Content>
            </Dialog.Portal>
        </Dialog.Root>
    );
}

function HistoryCard({ item, onRevert, onFork, isReverting, isForking }: {
    item: any,
    onRevert: () => void,
    onFork: () => void,
    isReverting: boolean,
    isForking: boolean
}) {
    const formatDate = (timestamp: number) => {
        return new Intl.DateTimeFormat('en-US', {
            month: 'short',
            day: 'numeric',
            hour: 'numeric',
            minute: 'numeric'
        }).format(new Date(timestamp));
    };

    return (
        <div className="group relative bg-white rounded-xl border border-gray-200 shadow-sm hover:shadow-md transition-all overflow-hidden flex flex-col">
            {/* Thumbnail */}
            <div className="aspect-video bg-gray-100 relative overflow-hidden">
                <BoardThumbnail elements={item.excalidrawElements} />

                {/* Overlay Actions */}
                <div className="absolute inset-0 bg-black/40 opacity-0 group-hover:opacity-100 transition-opacity flex items-center justify-center gap-3 backdrop-blur-[1px]">
                    <button
                        onClick={onRevert}
                        disabled={isReverting}
                        className="flex items-center gap-2 px-3 py-2 bg-white text-gray-900 rounded-lg text-sm font-medium hover:bg-gray-50 transition-colors shadow-lg"
                        title="Revert to this version"
                    >
                        <RotateCcw className="w-4 h-4" />
                        Revert
                    </button>
                    <button
                        onClick={onFork}
                        disabled={isForking}
                        className="flex items-center gap-2 px-3 py-2 bg-[#3B82F6] text-white rounded-lg text-sm font-medium hover:bg-[#2563EB] transition-colors shadow-lg"
                        title="Create new board from this version"
                    >
                        <Copy className="w-4 h-4" />
                        Fork
                    </button>
                </div>
            </div>

            {/* Footer */}
            <div className="p-3 border-t border-gray-100">
                <div className="flex justify-between items-center">
                    <span className="font-mono text-xs text-gray-500 bg-gray-100 px-2 py-1 rounded">
                        v{item.version}
                    </span>
                    <span className="text-xs text-gray-500">
                        {formatDate(item.timestamp)}
                    </span>
                </div>
                <div className="mt-1 text-sm font-medium text-gray-900 truncate">
                    {item.title || 'Untitled'}
                </div>
            </div>
        </div>
    );
}

// Reusing the BoardThumbnail logic but simplified for this context
function BoardThumbnail({ elements }: { elements?: any[] }) {
    const [thumbnail, setThumbnail] = useState<string | null>(null);

    useEffect(() => {
        let isMounted = true;

        const generateThumbnail = async () => {
            if (!elements || elements.length === 0) {
                if (isMounted) setThumbnail(null);
                return;
            }

            try {
                const blob = await exportToBlob({
                    elements: elements.filter((x: any) => !x.isDeleted),
                    appState: {
                        exportWithDarkMode: false,
                        viewBackgroundColor: "#ffffff",
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
            }
        };

        generateThumbnail();

        return () => {
            isMounted = false;
            if (thumbnail) URL.revokeObjectURL(thumbnail);
        };
    }, [elements]);

    if (!thumbnail) {
        return (
            <div className="w-full h-full flex items-center justify-center text-gray-300">
                <Clock className="w-8 h-8 opacity-20" />
            </div>
        );
    }

    return (
        <img
            src={thumbnail}
            alt="Version thumbnail"
            className="w-full h-full object-contain"
        />
    );
}

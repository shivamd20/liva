import { Share2, MessageCircle, Copy, Check, Globe, Info, Loader2, X, Pin, PanelRightClose, PanelRightOpen, ArrowRightFromLine, ArrowLeftToLine } from 'lucide-react';
import { useState, useEffect } from 'react';
import { toast } from 'sonner';
import { Board } from '../types';
import { mixpanelService, MixpanelEvents } from '../lib/mixpanel';
import { Button } from './ui/button';
import { Label } from './ui/label';
import { Input } from './ui/input';
import { useToggleShare } from '../hooks/useBoards';
// @ts-ignore
import { Alert, AlertDescription, AlertTitle } from "./ui/alert";
import { ConversationTab } from './ConversationTab';
import { cn } from '../lib/utils';
import { Tooltip, TooltipContent, TooltipProvider, TooltipTrigger } from './ui/tooltip';

interface PanelProps {
    isOpen: boolean;
    activeTab: 'share' | 'conversation' | null;
    isPinned: boolean;
    onTogglePin: () => void;
    onClose: () => void;
    board: Board;
    isOwner: boolean;
    excalidrawAPI: any | null; // Typed loosely to avoid circular deps or complex imports, or define properly if easy
}

const ShareTab = ({ board, isOwner }: { board: Board; isOwner: boolean }) => {
    const [copied, setCopied] = useState(false);
    const { mutate: toggleShare, isPending } = useToggleShare();
    const isPublic = board.access === 'public';

    const onCopy = async () => {
        await navigator.clipboard.writeText(window.location.href);
        setCopied(true);
        toast.success("Link copied to clipboard");
        setTimeout(() => setCopied(false), 2000);
    };

    const onToggle = () => {
        if (!isOwner) return;
        toggleShare(board.id, {
            onSuccess: (updated: Board) => {
                const newStatus = updated.access === 'public';
                toast.success(newStatus ? "Board is now public" : "Board is now private");
                mixpanelService.track(MixpanelEvents.BOARD_SHARE_TOGGLE, {
                    boardId: board.id,
                    isPublic: newStatus,
                    source: 'Sidebar'
                });
            },
            onError: () => {
                toast.error("Failed to update share settings");
            }
        });
    };

    return (
        <div className="h-full flex flex-col animate-in fade-in duration-300">
            <div className="px-5 py-4 border-b bg-muted/20">
                <h2 className="font-semibold text-lg tracking-tight">Share Board</h2>
                <p className="text-sm text-muted-foreground">Manage access and collaboration</p>
            </div>

            <div className="p-5 space-y-6">
                <div className="flex flex-col items-center justify-center py-6 space-y-5 text-center">
                    <div className={cn(
                        "p-4 rounded-full transition-colors duration-500",
                        isPublic
                            ? 'bg-blue-100 text-blue-600 dark:bg-blue-500/10 dark:text-blue-400'
                            : 'bg-muted text-muted-foreground'
                    )}>
                        <Globe className="w-8 h-8" />
                    </div>

                    <div className="space-y-1.5 max-w-[260px]">
                        <h3 className="font-semibold text-base tracking-tight">
                            {isPublic ? "This board is public" : "Private Board"}
                        </h3>
                        <p className="text-sm text-muted-foreground leading-relaxed">
                            {isPublic
                                ? "Anyone with the link can view and collaborate on this board."
                                : "Only you can see this board. Publish it to share with others."
                            }
                        </p>
                    </div>

                    {isOwner ? (
                        <Button
                            onClick={onToggle}
                            disabled={isPending}
                            className={cn(
                                "w-full max-w-[200px] h-10 shadow-sm transition-all duration-300",
                                isPublic
                                    ? "bg-background border border-input hover:bg-muted text-foreground hover:text-red-600 hover:border-red-200 dark:hover:border-red-900/50"
                                    : "bg-blue-600 hover:bg-blue-700 text-white shadow-blue-200 dark:shadow-blue-900/20"
                            )}
                        >
                            {isPending ? (
                                <Loader2 className="w-4 h-4 mr-2 animate-spin" />
                            ) : (
                                isPublic ? "Stop Sharing" : "Publish to Web"
                            )}
                        </Button>
                    ) : (
                        <div className={cn(
                            "px-3 py-1 rounded-full text-xs font-medium",
                            isPublic
                                ? 'bg-blue-100 text-blue-700 dark:bg-blue-900/30 dark:text-blue-400'
                                : 'bg-zinc-100 text-zinc-700 dark:bg-zinc-800 dark:text-zinc-400'
                        )}>
                            {isPublic ? 'Public Access' : 'Private Access'}
                        </div>
                    )}
                </div>

                {isPublic && (
                    <div className="space-y-3 animate-in fade-in slide-in-from-top-2 duration-200">
                        <Label className="text-xs font-medium text-muted-foreground uppercase tracking-wider">
                            Board Link
                        </Label>
                        <div className="flex gap-2">
                            <Input
                                readOnly
                                value={typeof window !== 'undefined' ? window.location.href : ''}
                                className="h-12 font-mono text-xs bg-muted/50"
                            />
                            <Button
                                size="sm"
                                variant="outline"
                                className="h-7 px-2 hover:bg-blue-50 hover:text-blue-600 dark:hover:bg-blue-950/20"
                                onClick={onCopy}
                            >
                                {copied ? (
                                    <Check className="w-4 h-4" />
                                ) : (
                                    <Copy className="w-4 h-4" />
                                )}
                                <span className="sr-only">Copy</span>
                            </Button>
                        </div>
                    </div>
                )}

                <Alert className="bg-blue-50/50 border-blue-100 dark:bg-blue-950/10 dark:border-blue-900/50">
                    <Info className="h-4 w-4 text-blue-600 dark:text-blue-400" />
                    <AlertTitle className="text-blue-700 dark:text-blue-400 font-medium">
                        Real-time Collaboration
                    </AlertTitle>
                    <AlertDescription className="text-blue-600/90 dark:text-blue-400/80 text-xs mt-1">
                        Changes sync instantly across all connected devices when public access is enabled.
                    </AlertDescription>
                </Alert>
            </div>
        </div>
    );
};

export const AssistantPanel = ({ isOpen, activeTab, isPinned, onTogglePin, onClose, board, isOwner, excalidrawAPI }: PanelProps) => {
    // If closed, we don't render content to save resources, or we can keep it mounted but hidden.
    // Given the requirement for "slide over", usually it's better to keep it mounted and transform it off-screen,
    // but for now, we'll handle layout in the parent and just render the container here.

    // Actually, usually managing mounting is better for performance if the content is heavy (like 3D scenes),
    // but for text/UI, keeping it mounted preserves state (like input text).
    // Lets keep it mounted and use CSS transforms/visibility if needed, OR just let the parent handle conditional rendering.
    // The parent (BoardEditor) will likely control the layout.

    if (!isOpen) return null;

    return (
        <div className="h-full w-full flex flex-col bg-background/95 backdrop-blur-xl border-l shadow-2xl relative overflow-hidden">
            <div className="h-10 border-b flex items-center justify-between px-2 bg-muted/30 shrink-0">
                <div className="flex items-center gap-2">
                    {/* Header Controls - maybe tabs switcher here? */}
                </div>
                <div className="flex items-center gap-1">
                    <TooltipProvider>
                        {/* <Tooltip>
                            <TooltipTrigger asChild>
                                <Button
                                    variant="ghost"
                                    size="icon"
                                    className="h-7 w-7 text-muted-foreground hover:text-foreground"
                                    onClick={onTogglePin}
                                >
                                    {isPinned ? (
                                        <ArrowRightFromLine className="h-4 w-4" />
                                    ) : (
                                        <ArrowLeftToLine className="h-4 w-4" />
                                    )}
                                </Button>
                            </TooltipTrigger>
                            <TooltipContent>
                                {isPinned ? "Unpin Panel" : "Pin Panel"}
                            </TooltipContent>
                        </Tooltip> */}

                        <Tooltip>
                            <TooltipTrigger asChild>
                                <Button
                                    variant="ghost"
                                    size="icon"
                                    className="h-7 w-7 text-muted-foreground hover:text-foreground"
                                    onClick={onClose}
                                >
                                    <X className="h-4 w-4" />
                                </Button>
                            </TooltipTrigger>
                            <TooltipContent>Close</TooltipContent>
                        </Tooltip>
                    </TooltipProvider>
                </div>
            </div>

            <div className="flex-1 overflow-hidden relative">
                {activeTab === 'share' && <ShareTab board={board} isOwner={isOwner} />}
                {activeTab === 'conversation' && (
                    <div className="h-full flex flex-col">
                        {/* We just need the content, wrapper styles can be minimal */}
                        <ConversationTab conversationId={board.id} excalidrawAPI={excalidrawAPI} />
                    </div>
                )}
            </div>
        </div>
    );
};

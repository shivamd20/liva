import { Sidebar } from '@excalidraw/excalidraw';
import { Share2, MessageCircle, Copy, Check, Globe, Info, Loader2 } from 'lucide-react';
import { useState } from 'react';
import { toast } from 'sonner';
import { Board } from '../types';
import { mixpanelService, MixpanelEvents } from '../lib/mixpanel';
import { Button } from './ui/button';
import { Label } from './ui/label';
import { Input } from './ui/input';
import { useToggleShare } from '../hooks/useBoards';

export const SIDEBAR_NAME = "custom-sidebar";

interface BoardSidebarProps {
    board: Board;
    isOwner: boolean;
}

import { Alert, AlertDescription, AlertTitle } from "./ui/alert";

const ShareTab = ({ board, isOwner }: BoardSidebarProps) => {
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
        <div className="h-full flex flex-col">
            <div className="px-5 py-4 border-b bg-muted/20">
                <h2 className="font-semibold text-lg tracking-tight">Share Board</h2>
                <p className="text-sm text-muted-foreground">Manage access and collaboration</p>
            </div>

            <div className="p-5 space-y-6">
                <div className="flex flex-col items-center justify-center py-6 space-y-5 text-center">
                    <div className={`p-4 rounded-full transition-colors duration-500 ${isPublic
                        ? 'bg-blue-100 text-blue-600 dark:bg-blue-500/10 dark:text-blue-400'
                        : 'bg-muted text-muted-foreground'
                        }`}>
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
                            className={`w-full max-w-[200px] h-10 shadow-sm transition-all duration-300 ${isPublic
                                ? "bg-background border border-input hover:bg-muted text-foreground hover:text-red-600 hover:border-red-200 dark:hover:border-red-900/50"
                                : "bg-blue-600 hover:bg-blue-700 text-white shadow-blue-200 dark:shadow-blue-900/20"
                                }`}
                        >
                            {isPending ? (
                                <Loader2 className="w-4 h-4 mr-2 animate-spin" />
                            ) : (
                                isPublic ? "Stop Sharing" : "Publish to Web"
                            )}
                        </Button>
                    ) : (
                        <div className={`px-3 py-1 rounded-full text-xs font-medium ${isPublic
                            ? 'bg-blue-100 text-blue-700 dark:bg-blue-900/30 dark:text-blue-400'
                            : 'bg-zinc-100 text-zinc-700 dark:bg-zinc-800 dark:text-zinc-400'
                            }`}>
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
                                size="xs"
                                variant="outline"
                                className="hover:bg-blue-50 hover:text-blue-600 dark:hover:bg-blue-950/20"
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

const ConversationTab = () => (
    <div className="flex flex-col h-full items-center justify-center p-8 text-center bg-background/50">
        <div className="w-12 h-12 rounded-xl bg-muted/50 flex items-center justify-center mb-4">
            <MessageCircle className="w-6 h-6 text-muted-foreground/60" />
        </div>
        <h3 className="font-semibold text-foreground mb-1">Conversations</h3>
        <p className="text-sm text-muted-foreground max-w-[200px] leading-relaxed">
            Discuss and collaborate directly on the board.
        </p>
        <div className="mt-4 px-3 py-1 bg-muted/30 rounded-full text-[10px] font-medium text-muted-foreground uppercase tracking-wider border">
            Coming Soon
        </div>
    </div>
);

export const BoardSidebar = ({ board, isOwner }: BoardSidebarProps) => {
    return (
        // @ts-ignore
        <Sidebar
            name={SIDEBAR_NAME}
        >

            <Sidebar.Tabs >

                <Sidebar.Tab tab="share">
                    <ShareTab board={board} isOwner={isOwner} />
                </Sidebar.Tab>
                <Sidebar.Tab tab="conversation">
                    <ConversationTab />
                </Sidebar.Tab>
            </Sidebar.Tabs>
        </Sidebar>
    );
};

export const BoardSidebarTriggers = ({ isMobile, isShared }: { isMobile: boolean; isShared: boolean }) => {
    return (
        <div className="flex gap-2">
            <Sidebar.Trigger
                name={SIDEBAR_NAME}
                tab="share"
                title={isShared ? "Board is Public" : "Share Board"}
            >
                {isShared ? (
                    <Globe className="w-4 h-4 text-blue-500" />
                ) : (
                    <Share2 className="w-4 h-4" />
                )}
            </Sidebar.Trigger>

            <Sidebar.Trigger
                name={SIDEBAR_NAME}
                tab="conversation"
                title="Conversations"
            >
                <MessageCircle className="w-4 h-4" />
            </Sidebar.Trigger>
        </div>
    );
};

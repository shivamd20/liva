import { Sidebar } from '@excalidraw/excalidraw';
import { Share2, MessageCircle, Copy, Check, Globe, Info, Loader2, Mic, MicOff, Pause, Play, Volume2 } from 'lucide-react';
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

export const SIDEBAR_NAME = "custom-sidebar";

interface BoardSidebarProps {
    board: Board;
    isOwner: boolean;
    speechState: {
        start: () => void;
        stop: () => void;
        pause: () => void;
        mute: () => void;
        connected: boolean;
        isMuted: boolean;
        isPaused: boolean;
        volume: number;
    }
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

const ConversationTab = ({ speechState }: { speechState: BoardSidebarProps['speechState'] }) => {
    const { start, stop, pause, mute, connected, isMuted, isPaused, volume } = speechState;

    // Simple visualizer bars
    const [bars, setBars] = useState<number[]>(new Array(5).fill(1));

    useEffect(() => {
        if (connected && !isPaused) {
            // Animate bars based on volume
            // Volume is 0-1 usually, scale to height
            const interval = setInterval(() => {
                setBars(prev => prev.map(() => Math.max(0.2, Math.min(1, volume * (Math.random() * 2 + 1)))));
            }, 100);
            return () => clearInterval(interval);
        } else {
            setBars(new Array(5).fill(0.2));
        }
    }, [connected, isPaused, volume]);

    const handleConnectToggle = () => {
        if (connected) {
            stop();
        } else {
            start();
        }
    };

    return (
        <div className="flex flex-col h-full bg-background">
            <div className="px-5 py-4 border-b bg-muted/20">
                <h2 className="font-semibold text-lg tracking-tight">Conversation</h2>
                <p className="text-sm text-muted-foreground">Talk with your AI assistant</p>
            </div>

            <div className="flex-1 flex flex-col items-center justify-center p-6 space-y-8">

                {/* Status Indicator & Visualizer */}
                <div className="relative flex items-center justify-center w-32 h-32">
                    {connected ? (
                        <div className="flex items-end justify-center gap-1 h-16">
                            {bars.map((height, i) => (
                                <div
                                    key={i}
                                    className="w-3 bg-primary rounded-full transition-all duration-100 ease-in-out"
                                    style={{ height: `${height * 64}px` }}
                                />
                            ))}
                        </div>
                    ) : (
                        <div className="w-24 h-24 rounded-full bg-muted flex items-center justify-center">
                            <MicOff className="w-10 h-10 text-muted-foreground" />
                        </div>
                    )}

                    {/* Status Badge */}
                    <div className={`absolute -bottom-2 px-3 py-1 rounded-full text-xs font-medium border ${connected
                        ? 'bg-green-100 text-green-700 border-green-200 dark:bg-green-900/30 dark:text-green-400 dark:border-green-800'
                        : 'bg-zinc-100 text-zinc-600 border-zinc-200 dark:bg-zinc-800 dark:text-zinc-400 dark:border-zinc-700'
                        }`}>
                        {connected ? (isPaused ? 'Paused' : 'Listening') : 'Disconnected'}
                    </div>
                </div>

                {/* Main Controls */}
                <div className="flex flex-col items-center gap-6 w-full max-w-xs">
                    <Button
                        size="lg"
                        className={`w-16 h-16 rounded-full shadow-lg transition-all duration-300 ${connected
                            ? 'bg-red-500 hover:bg-red-600 text-white shadow-red-200 dark:shadow-red-900/20'
                            : 'bg-primary hover:bg-primary/90 text-primary-foreground shadow-blue-200 dark:shadow-blue-900/20'
                            }`}
                        onClick={handleConnectToggle}
                    >
                        {connected ? (
                            <MicOff className="w-8 h-8" />
                        ) : (
                            <Mic className="w-8 h-8" />
                        )}
                    </Button>

                    <div className="flex items-center gap-4">
                        <Button
                            variant="outline"
                            size="icon"
                            disabled={!connected}
                            onClick={pause}
                            className={`h-12 w-12 rounded-full ${isPaused ? 'bg-muted text-muted-foreground' : ''}`}
                        >
                            {isPaused ? <Play className="w-5 h-5" /> : <Pause className="w-5 h-5" />}
                        </Button>

                        <Button
                            variant="outline"
                            size="icon"
                            disabled={!connected}
                            onClick={mute}
                            className={`h-12 w-12 rounded-full ${isMuted ? 'text-red-500 border-red-200 bg-red-50 dark:bg-red-900/10' : ''}`}
                        >
                            {isMuted ? <Volume2 className="w-5 h-5 rotate-45" /> : <Volume2 className="w-5 h-5" />}
                        </Button>
                    </div>
                </div>

                <div className="text-center space-y-2 max-w-[200px]">
                    <p className="text-xs text-muted-foreground leading-relaxed">
                        {connected
                            ? "Speak naturally to interact with the assistant."
                            : "Start a conversation to get help with your board."
                        }
                    </p>
                </div>

            </div>
        </div>
    );
};

export const BoardSidebar = ({ board, isOwner, speechState }: BoardSidebarProps) => {
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
                    <ConversationTab speechState={speechState} />
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

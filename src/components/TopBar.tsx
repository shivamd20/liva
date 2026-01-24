import React, { useState, useEffect } from 'react';
import { Board } from '../types';
import { cn } from '../lib/utils';
import { Menu, Share2, MessageCircle, X, ChevronRight, Check, ChevronLeft, Mic, MicOff, Video, VideoOff, Square, Circle, Clock, Wifi, WifiOff, RefreshCcw } from 'lucide-react';
import { Button } from '@/components/ui/button';
import {
    DropdownMenu,
    DropdownMenuContent,
    DropdownMenuItem,
    DropdownMenuLabel,
    DropdownMenuSeparator,
    DropdownMenuTrigger,
    DropdownMenuGroup,
    DropdownMenuShortcut
} from '@/components/ui/dropdown-menu';
import { ConnectionStatus } from '@shvm/excalidraw-live-sync';

export interface TopBarMenuItem {
    label: string;
    onClick: () => void;
    icon?: React.ReactNode;
    shortcut?: string;
    variant?: 'default' | 'destructive';
    separator?: boolean;
}

interface TopBarProps {
    board: Board;
    menuItems: TopBarMenuItem[];
    onToggleShare: () => void;
    onToggleChat: () => void;
    isShareOpen: boolean;
    isChatOpen: boolean;
    onBack: () => void;
    onTitleChange: (newTitle: string) => void;
    onToggleRecordings?: () => void;

    // Recording props
    isRecording?: boolean;
    onStartRecording?: () => void;
    onStopRecording?: () => void;
    recordingDuration?: number; // in seconds
    onToggleMute?: () => void;
    isMuted?: boolean;
    onToggleVideo?: () => void;
    isVideoEnabled?: boolean;
    recordingSessionId?: string | null;
    onConnectYouTube?: () => void;
    uploadStatus?: 'INIT' | 'UPLOADING_TO_YT' | 'DONE' | 'FAILED' | null;
    uploadProgress?: number;

    // Connection Status
    connectionStatus?: ConnectionStatus;
    onReconnect?: () => void;
}

export function TopBar({
    board,
    menuItems,
    onToggleShare,
    onToggleChat,
    isShareOpen,
    isChatOpen,
    onBack,
    onTitleChange,
    onToggleRecordings,

    isRecording = false,
    onStartRecording,
    onStopRecording,
    recordingDuration = 0,
    onToggleMute,
    isMuted = false,
    onToggleVideo,
    isVideoEnabled = true,
    recordingSessionId,
    onConnectYouTube,
    uploadStatus,
    uploadProgress,
    connectionStatus,
    onReconnect
}: TopBarProps) {
    const [timeLeft, setTimeLeft] = useState<number | null>(null);
    const [isEditingTitle, setIsEditingTitle] = useState(false);
    const [tempTitle, setTempTitle] = useState(board.title);

    useEffect(() => {
        setTempTitle(board.title);
    }, [board.title]);

    useEffect(() => {
        if (!board.expiresAt) return;

        const interval = setInterval(() => {
            const now = Date.now();
            const remaining = Math.max(0, board.expiresAt! - now);
            setTimeLeft(remaining);
        }, 1000);

        return () => clearInterval(interval);
    }, [board.expiresAt]);

    const formatTime = (ms: number) => {
        const totalSeconds = Math.floor(ms / 1000);
        const minutes = Math.floor(totalSeconds / 60);
        const seconds = totalSeconds % 60;
        return `${minutes.toString().padStart(2, '0')}:${seconds.toString().padStart(2, '0')}`;
    };

    const formatDuration = (totalSeconds: number) => {
        const minutes = Math.floor(totalSeconds / 60);
        const seconds = totalSeconds % 60;
        return `${minutes.toString().padStart(2, '0')}:${seconds.toString().padStart(2, '0')}`;
    };

    const getTimerColor = (ms: number | null) => {
        if (ms === null) return 'text-neutral-500';
        const minutes = ms / 1000 / 60;
        if (minutes < 2) return 'text-red-600'; // Danger
        if (minutes < 10) return 'text-yellow-600'; // Warning
        return 'text-neutral-900 dark:text-neutral-100'; // Normal
    };

    const handleTitleSubmit = () => {
        setIsEditingTitle(false);
        if (tempTitle.trim() && tempTitle !== board.title) {
            onTitleChange(tempTitle);
        } else {
            setTempTitle(board.title);
        }
    };

    // Helper to render the colored dot/indicator
    const renderConnectionIndicator = () => {
        if (!connectionStatus) return null;
        switch (connectionStatus) {
            case 'connected':
                return <div className="w-2.5 h-2.5 rounded-full bg-green-500 shadow-[0_0_8px_rgba(34,197,94,0.5)]" />;
            case 'connecting':
            case 'reconnecting':
                return <div className="w-2.5 h-2.5 rounded-full bg-yellow-500 animate-pulse" />;
            case 'disconnected':
                return <div className="w-2.5 h-2.5 rounded-full bg-neutral-300 dark:bg-neutral-600" />;
            default:
                return null;
        }
    };

    const getConnectionStatusLabel = () => {
        switch (connectionStatus) {
            case 'connected': return 'Connected';
            case 'connecting': return 'Connecting...';
            case 'reconnecting': return 'Reconnecting...';
            case 'disconnected': return 'Disconnected';
            default: return 'Unknown';
        }
    }

    return (
        <div className="h-12 w-full relative flex items-center justify-between px-4 select-none bg-white/80 dark:bg-neutral-950/80 backdrop-blur-md border-b border-neutral-200/50 dark:border-neutral-800/50 transition-all duration-300">
            {/* 1. Left: Back, Hamburger & Title */}
            <div className="flex-1 flex items-center gap-2 mr-4">
                <Button
                    variant="ghost"
                    size="icon"
                    className="h-8 w-8 hover:bg-neutral-100 dark:hover:bg-neutral-800 -ml-2"
                    onClick={onBack}
                    title="Back to boards"
                >
                    <ChevronLeft className="h-5 w-5 text-neutral-600 dark:text-neutral-400" />
                </Button>

                <div className="h-4 w-[1px] bg-neutral-200 dark:bg-neutral-800 mx-1" />

                <DropdownMenu>
                    <DropdownMenuTrigger asChild>
                        <Button variant="ghost" size="icon" className="h-8 w-8 hover:bg-neutral-100 dark:hover:bg-neutral-800">
                            <Menu className="h-5 w-5 text-neutral-600 dark:text-neutral-400" />
                        </Button>
                    </DropdownMenuTrigger>
                    <DropdownMenuContent align="start" className="w-56">
                        <DropdownMenuLabel>Board Menu</DropdownMenuLabel>
                        <DropdownMenuSeparator />
                        <DropdownMenuGroup>
                            {menuItems.map((item, index) => (
                                <React.Fragment key={index}>
                                    {item.separator && <DropdownMenuSeparator />}
                                    <DropdownMenuItem
                                        onClick={item.onClick}
                                        className={cn(
                                            "flex items-center gap-2 cursor-pointer",
                                            item.variant === 'destructive' && "text-red-600 focus:text-red-600 focus:bg-red-50 dark:focus:bg-red-950/20"
                                        )}
                                    >
                                        {item.icon && <span className="h-4 w-4">{item.icon}</span>}
                                        <span>{item.label}</span>
                                        {item.shortcut && <DropdownMenuShortcut>{item.shortcut}</DropdownMenuShortcut>}
                                    </DropdownMenuItem>
                                </React.Fragment>
                            ))}
                        </DropdownMenuGroup>
                    </DropdownMenuContent>
                </DropdownMenu>

                <div className="h-4 w-[1px] bg-neutral-200 dark:bg-neutral-800 mx-1" />

                {isEditingTitle ? (
                    <input
                        autoFocus
                        type="text"
                        value={tempTitle}
                        onChange={(e) => setTempTitle(e.target.value)}
                        onBlur={handleTitleSubmit}
                        onKeyDown={(e) => {
                            if (e.key === 'Enter') handleTitleSubmit();
                            if (e.key === 'Escape') {
                                setTempTitle(board.title);
                                setIsEditingTitle(false);
                            }
                        }}
                        className="bg-transparent text-sm font-medium tracking-tight text-neutral-900 dark:text-neutral-200 outline-none border-b border-blue-500 w-full max-w-[200px]"
                    />
                ) : (
                    <h1
                        onClick={() => setIsEditingTitle(true)}
                        className="text-sm font-medium tracking-tight text-neutral-900 dark:text-neutral-200 truncate font-sans hover:bg-neutral-100 dark:hover:bg-neutral-800 px-2 py-1 rounded cursor-pointer transition-colors"
                        title="Click to rename"
                    >
                        {board.title}
                    </h1>
                )}
            </div>

            {/* 2. Right: Controls */}
            <div className="flex-1 flex justify-end items-center gap-3">
                {/* Connection Status Indicator */}
                {connectionStatus && (
                    <DropdownMenu>
                        <DropdownMenuTrigger asChild>
                            <button className="group outline-none relative flex items-center justify-center p-2 hover:bg-neutral-100 dark:hover:bg-neutral-800 rounded-full transition-colors cursor-pointer">
                                {renderConnectionIndicator()}
                            </button>
                        </DropdownMenuTrigger>
                        <DropdownMenuContent align="end" className="w-56">
                            <DropdownMenuLabel className="flex items-center justify-between">
                                <span>Sync Status</span>
                                <span className={cn(
                                    "text-xs font-normal px-2 py-0.5 rounded-full capitalize",
                                    connectionStatus === 'connected' ? "bg-green-100 text-green-700 dark:bg-green-900/30 dark:text-green-400" :
                                        connectionStatus === 'disconnected' ? "bg-neutral-100 text-neutral-600 dark:bg-neutral-800 dark:text-neutral-400" :
                                            "bg-yellow-100 text-yellow-700 dark:bg-yellow-900/30 dark:text-yellow-400"
                                )}>
                                    {getConnectionStatusLabel()}
                                </span>
                            </DropdownMenuLabel>
                            <DropdownMenuSeparator />
                            <div className="px-2 py-2 text-xs text-neutral-500 dark:text-neutral-400 font-mono break-all">
                                Board ID: {board.id.substring(0, 8)}...
                            </div>
                            <DropdownMenuSeparator />
                            <DropdownMenuItem
                                onClick={onReconnect}
                                disabled={connectionStatus === 'connected' || connectionStatus === 'connecting'}
                                className="cursor-pointer"
                            >
                                <RefreshCcw className={cn("w-4 h-4 mr-2", (connectionStatus === 'connecting' || connectionStatus === 'reconnecting') && "animate-spin")} />
                                <span>
                                    {(connectionStatus === 'connecting' || connectionStatus === 'reconnecting') ? 'Connecting...' : 'Reconnect Now'}
                                </span>
                            </DropdownMenuItem>
                        </DropdownMenuContent>
                    </DropdownMenu>
                )}

                {onConnectYouTube && (
                    <Button
                        variant="outline"
                        size="sm"
                        onClick={onConnectYouTube}
                        className="h-8 gap-2 text-red-600 bg-red-50 hover:bg-red-100 dark:bg-red-950/30 dark:hover:bg-red-950/50 hidden md:flex"
                    >
                        <span className="text-xs font-medium">Connect YouTube</span>
                    </Button>
                )}

                {/* Upload Status */}
                {uploadStatus && uploadStatus !== 'DONE' && uploadStatus !== 'FAILED' && (
                    <div className="flex items-center gap-2 px-3 py-1 bg-blue-50 dark:bg-blue-950/30 rounded-full border border-blue-100 dark:border-blue-900/50">
                        <div className="w-2 h-2 rounded-full bg-blue-500 animate-pulse" />
                        <span className="text-xs font-medium text-blue-700 dark:text-blue-300">
                            {uploadStatus === 'INIT' ? 'Preparing...' : `Uploading ${uploadProgress ? Math.round(uploadProgress * 100) : 0}%`}
                        </span>
                    </div>
                )}
                {uploadStatus === 'DONE' && (
                    <div className="flex items-center gap-2 px-3 py-1 bg-green-50 dark:bg-green-950/30 rounded-full border border-green-100 dark:border-green-900/50">
                        <Check className="w-3 h-3 text-green-600 dark:text-green-400" />
                        <span className="text-xs font-medium text-green-700 dark:text-green-300">
                            Uploaded
                        </span>
                    </div>
                )}

                {/* Recording Controls */}
                <div className="flex items-center gap-2 mr-2">
                    {isRecording ? (
                        <>
                            <div className="flex items-center gap-2 px-2 py-1 bg-red-50 dark:bg-red-950/30 rounded-md border border-red-100 dark:border-red-900/50">
                                <div className="w-2 h-2 rounded-full bg-red-600 animate-pulse" />
                                <span className="text-xs font-mono font-medium text-red-600 dark:text-red-400 tabular-nums">
                                    {formatDuration(recordingDuration)}
                                </span>
                            </div>

                            <Button
                                variant="ghost"
                                size="icon"
                                onClick={onToggleMute}
                                className={cn("h-8 w-8", isMuted && "text-red-500")}
                                title={isMuted ? "Unmute" : "Mute"}
                            >
                                {isMuted ? <MicOff className="h-4 w-4" /> : <Mic className="h-4 w-4" />}
                            </Button>

                            <Button
                                variant="ghost"
                                size="icon"
                                onClick={onToggleVideo}
                                className={cn("h-8 w-8", !isVideoEnabled && "text-red-500")}
                                title={isVideoEnabled ? "Turn off video" : "Turn on video"}
                            >
                                {isVideoEnabled ? <Video className="h-4 w-4" /> : <VideoOff className="h-4 w-4" />}
                            </Button>

                            <Button
                                variant="destructive"
                                size="sm"
                                onClick={onStopRecording}
                                className="h-8 px-3 gap-2"
                            >
                                <Square className="h-3 w-3 fill-current" />
                                <span className="hidden sm:inline">Stop</span>
                            </Button>
                        </>
                    ) : (
                        <Button
                            variant="outline"
                            size="sm"
                            onClick={onStartRecording}
                            className="h-8 gap-2 text-neutral-600 dark:text-neutral-400 hover:text-red-600 dark:hover:text-red-400 hover:border-red-200 dark:hover:border-red-900/50"
                        >
                            <div className="w-2 h-2 rounded-full bg-red-600" />
                            <span className="hidden sm:inline">Record</span>
                        </Button>
                    )}
                </div>

                <div className="h-4 w-[1px] bg-neutral-200 dark:bg-neutral-800 mx-1" />

                {/* Share Button */}
                <Button
                    variant="ghost"
                    size="icon"
                    onClick={onToggleShare}
                    className={cn(
                        "h-8 w-8 transition-colors",
                        isShareOpen ? "bg-neutral-100 dark:bg-neutral-800 text-neutral-900 dark:text-neutral-100" : "text-neutral-500 hover:text-neutral-900 dark:hover:text-neutral-100"
                    )}
                >
                    <Share2 className="h-4 w-4" />
                </Button>

                {/* Chat Button */}
                <Button
                    variant="ghost"
                    size="icon"
                    onClick={onToggleChat}
                    className={cn(
                        "h-8 w-8 transition-colors",
                        isChatOpen ? "bg-neutral-100 dark:bg-neutral-800 text-neutral-900 dark:text-neutral-100" : "text-neutral-500 hover:text-neutral-900 dark:hover:text-neutral-100"
                    )}
                >
                    <MessageCircle className="h-4 w-4" />
                </Button>

                {onToggleRecordings && (
                    <Button
                        variant="ghost"
                        size="icon"
                        onClick={onToggleRecordings}
                        className="h-8 w-8 text-neutral-500 hover:text-neutral-900 dark:hover:text-neutral-100 transition-colors"
                        title="View Recordings"
                    >
                        <Clock className="h-4 w-4" />
                    </Button>
                )}

                {/* Subtle expiry indicator in top-right */}
                {board.expiresAt && timeLeft !== null && (
                    <div className={cn(
                        "text-[10px] font-mono tabular-nums transition-colors px-2 py-1 rounded",
                        getTimerColor(timeLeft)
                    )} title="Time remaining">
                        {formatTime(timeLeft)}
                    </div>
                )}
            </div>
        </div>
    );
}

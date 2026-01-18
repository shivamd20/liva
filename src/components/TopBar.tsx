import React, { useState, useEffect } from 'react';
import { Board } from '../types';
import { cn } from '../lib/utils';
import { Menu, Share2, MessageCircle, X, ChevronRight, Check, ChevronLeft } from 'lucide-react';
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
    onSubmit: () => void;
    menuItems: TopBarMenuItem[];
    onToggleShare: () => void;
    onToggleChat: () => void;
    isShareOpen: boolean;
    isChatOpen: boolean;
    onBack: () => void;
    onTitleChange: (newTitle: string) => void;
}

export function TopBar({
    board,
    onSubmit,
    menuItems,
    onToggleShare,
    onToggleChat,
    isShareOpen,
    isChatOpen,
    onBack,
    onTitleChange
}: TopBarProps) {
    const [timeLeft, setTimeLeft] = useState<number | null>(null);
    const [status, setStatus] = useState<'in_progress' | 'expired' | 'submitted'>('in_progress');
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

            if (remaining <= 0 && status !== 'submitted') {
                setStatus('expired');
            }
        }, 1000);

        return () => clearInterval(interval);
    }, [board.expiresAt, status]);

    const formatTime = (ms: number) => {
        const totalSeconds = Math.floor(ms / 1000);
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

    const displayStatus = () => {
        if (status === 'submitted') return 'Submitted';
        if (status === 'expired') return 'Expired';
        return 'In Progress';
    };

    const handleTitleSubmit = () => {
        setIsEditingTitle(false);
        if (tempTitle.trim() && tempTitle !== board.title) {
            onTitleChange(tempTitle);
        } else {
            setTempTitle(board.title);
        }
    };

    return (
        <div className="h-12 w-full relative  flex items-center justify-between px-4 select-none bg-white/80 dark:bg-neutral-950/80 backdrop-blur-md border-b border-neutral-200/50 dark:border-neutral-800/50 transition-all duration-300">
            {/* 1. Left: Back, Hamburger & Title */}
            <div className="flex-1 flex items-center gap-2  mr-4">
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

            {/* 2. Center: Timer */}
            <div className="flex-none flex justify-center items-center absolute left-1/2 -translate-x-1/2 pointer-events-none">
                <div className={cn(
                    "text-xl font-medium font-mono tracking-tight tabular-nums transition-colors duration-300 opacity-90",
                    getTimerColor(timeLeft)
                )}>
                    {timeLeft !== null ? formatTime(timeLeft) : "--:--"}
                </div>
            </div>

            {/* 3. Right: Controls & Status */}
            <div className="flex-1 flex justify-end items-center gap-3">
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

                <div className="h-4 w-[1px] bg-neutral-200 dark:bg-neutral-800 mx-1" />

                {/* Status */}
                <div className={cn(
                    "hidden sm:block text-xs font-medium tracking-wide uppercase",
                    status === 'in_progress' ? "text-emerald-600 dark:text-emerald-500" : "text-neutral-500"
                )}>
                    {displayStatus()}
                </div>

                {/* Submit */}
                <button
                    onClick={onSubmit}
                    className="px-3 py-1.5 bg-neutral-900 text-white dark:bg-white dark:text-neutral-900 rounded-md text-xs font-medium hover:opacity-90 active:scale-95 disabled:opacity-50 disabled:cursor-not-allowed transition-all shadow-sm"
                    disabled={status !== 'in_progress'}
                >
                    Submit
                </button>
            </div>
        </div>
    );
}

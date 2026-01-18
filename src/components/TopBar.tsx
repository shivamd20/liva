import React, { useState, useEffect } from 'react';
import { Board } from '../types';
import { cn } from '../lib/utils'; // Assuming this exists based on BoardEditor imports

interface TopBarProps {
    board: Board;
    onSubmit: () => void;
}

export function TopBar({ board, onSubmit }: TopBarProps) {
    const [timeLeft, setTimeLeft] = useState<number | null>(null);
    const [status, setStatus] = useState<'in_progress' | 'expired' | 'submitted'>('in_progress');

    useEffect(() => {
        // If no expiration, we might assume infinite time or just hide timer/status? 
        // Spec says "Timer Block (CENTER, dominant) ... Always visible"
        // If expiresAt is null/undefined, we'll treat it as standard 45 mins or just --:--?
        // Let's assume if expiresAt is set, we use it. If not, maybe we default to a standard time or hide it?
        // User said "Always visible". Let's handle expiresAt being present.
        // If expiresAt is missing, we can't really show a countdown. 
        // Logic: derived from current time and expiresAt

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

    return (
        <div className="h-12 w-full relative z-[60] flex items-center justify-between px-4 select-none bg-white/80 dark:bg-neutral-950/80 backdrop-blur-md border-b border-neutral-200/50 dark:border-neutral-800/50 transition-all duration-300">
            {/* 1. Problem Context Block (LEFT) */}
            <div className="flex-1 flex flex-col justify-center items-start overflow-hidden mr-4">
                <h1 className="text-sm font-medium tracking-tight text-neutral-900 dark:text-neutral-200 truncate max-w-full font-sans">
                    {board.title}
                </h1>
            </div>

            {/* 2. Timer Block (CENTER) */}
            <div className="flex-none flex justify-center items-center absolute left-1/2 -translate-x-1/2">
                <div className={cn(
                    "text-xl font-medium font-mono tracking-tight tabular-nums transition-colors duration-300 opacity-90",
                    getTimerColor(timeLeft)
                )}>
                    {timeLeft !== null ? formatTime(timeLeft) : "--:--"}
                </div>
            </div>

            {/* 3 & 4. Right Side: Status & Submit */}
            <div className="flex-1 flex justify-end items-center gap-4">
                {/* Attempt State Indicator */}
                <div className={cn(
                    "text-xs font-medium tracking-wide uppercase",
                    status === 'in_progress' ? "text-emerald-600 dark:text-emerald-500" : "text-neutral-500"
                )}>
                    {displayStatus()}
                </div>

                {/* Submission Control */}
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

import { useState, useRef, useEffect, useCallback } from 'react';
import { Play, Pause } from 'lucide-react';
import { Button } from '../ui/button';

interface AudioPlaybackBarProps {
    audioBlob: Blob;
    duration: number;
    compact?: boolean;
    variant?: 'user' | 'assistant';
}

export const AudioPlaybackBar = ({ audioBlob, duration, compact = false, variant = 'assistant' }: AudioPlaybackBarProps) => {
    const audioRef = useRef<HTMLAudioElement | null>(null);
    const [isPlaying, setIsPlaying] = useState(false);
    const [currentTime, setCurrentTime] = useState(0);
    const [audioUrl, setAudioUrl] = useState<string | null>(null);

    // Create object URL for the audio blob
    useEffect(() => {
        const url = URL.createObjectURL(audioBlob);
        setAudioUrl(url);

        return () => {
            URL.revokeObjectURL(url);
        };
    }, [audioBlob]);

    // Initialize audio element
    useEffect(() => {
        if (!audioUrl) return;

        const audio = new Audio(audioUrl);
        audioRef.current = audio;

        audio.addEventListener('timeupdate', () => {
            setCurrentTime(audio.currentTime);
        });

        audio.addEventListener('ended', () => {
            setIsPlaying(false);
            setCurrentTime(0);
        });

        audio.addEventListener('pause', () => {
            setIsPlaying(false);
        });

        audio.addEventListener('play', () => {
            setIsPlaying(true);
        });

        return () => {
            audio.pause();
            audio.src = '';
        };
    }, [audioUrl]);

    const togglePlayPause = useCallback(() => {
        if (!audioRef.current) return;

        if (isPlaying) {
            audioRef.current.pause();
        } else {
            audioRef.current.play();
        }
    }, [isPlaying]);

    const handleSeek = useCallback((e: React.MouseEvent<HTMLDivElement>) => {
        if (!audioRef.current) return;

        const rect = e.currentTarget.getBoundingClientRect();
        const clickX = e.clientX - rect.left;
        const percentage = clickX / rect.width;
        const newTime = percentage * duration;

        audioRef.current.currentTime = newTime;
        setCurrentTime(newTime);
    }, [duration]);

    const formatTime = (seconds: number) => {
        const mins = Math.floor(seconds / 60);
        const secs = Math.floor(seconds % 60);
        return `${mins}:${secs.toString().padStart(2, '0')}`;
    };

    const progress = duration > 0 ? (currentTime / duration) * 100 : 0;

    // Theme logic
    const isUser = variant === 'user';
    const textColor = isUser ? 'text-primary-foreground/90' : 'text-foreground/90';
    const subTextColor = isUser ? 'text-primary-foreground/70' : 'text-muted-foreground';
    const trackColor = isUser ? 'bg-primary-foreground/20' : 'bg-primary/10';
    const fillColor = isUser ? 'bg-primary-foreground' : 'bg-primary';
    const buttonHover = isUser ? 'hover:bg-primary-foreground/10' : 'hover:bg-primary/10';

    return (
        <div className={`flex items-center gap-2 ${compact ? 'w-32' : 'w-full'}`}>
            <Button
                variant="ghost"
                size="icon"
                onClick={togglePlayPause}
                className={`shrink-0 ${compact ? 'h-7 w-7' : 'h-8 w-8'} rounded-full ${buttonHover} ${textColor}`}
            >
                {isPlaying ? (
                    <Pause className={compact ? 'h-3 w-3' : 'h-4 w-4'} />
                ) : (
                    <Play className={compact ? 'h-3 w-3' : 'h-4 w-4'} />
                )}
            </Button>

            {/* Progress bar */}
            <div
                className={`flex-1 h-1.5 rounded-full cursor-pointer overflow-hidden ${trackColor}`}
                onClick={handleSeek}
            >
                <div
                    className={`h-full rounded-full transition-all duration-100 ${fillColor}`}
                    style={{ width: `${progress}%` }}
                />
            </div>

            {/* Time display */}
            <span className={`shrink-0 tabular-nums ${compact ? 'text-[10px]' : 'text-xs'} ${subTextColor}`}>
                {formatTime(currentTime)} / {formatTime(duration)}
            </span>
        </div>
    );
};

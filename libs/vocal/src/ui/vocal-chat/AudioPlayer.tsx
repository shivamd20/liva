import { useState, useRef, useEffect } from 'react';
import { Play, Pause, Volume2 } from 'lucide-react';
import { cn } from '../Button';

interface AudioPlayerProps {
    src: string;
    isUser: boolean;
}

export function AudioPlayer({ src, isUser }: AudioPlayerProps) {
    const audioRef = useRef<HTMLAudioElement>(null);
    const [isPlaying, setIsPlaying] = useState(false);
    const [duration, setDuration] = useState(0);
    const [currentTime, setCurrentTime] = useState(0);

    useEffect(() => {
        const audio = audioRef.current;
        if (!audio) return;

        const handleTimeUpdate = () => setCurrentTime(audio.currentTime);
        const handleLoadedMetadata = () => setDuration(audio.duration);
        const handleEnded = () => setIsPlaying(false);

        audio.addEventListener('timeupdate', handleTimeUpdate);
        audio.addEventListener('loadedmetadata', handleLoadedMetadata);
        audio.addEventListener('ended', handleEnded);

        return () => {
            audio.removeEventListener('timeupdate', handleTimeUpdate);
            audio.removeEventListener('loadedmetadata', handleLoadedMetadata);
            audio.removeEventListener('ended', handleEnded);
        };
    }, []);

    const togglePlay = () => {
        if (!audioRef.current) return;
        if (isPlaying) {
            audioRef.current.pause();
        } else {
            audioRef.current.play();
        }
        setIsPlaying(!isPlaying);
    };

    const formatTime = (time: number) => {
        if (!time || isNaN(time)) return "0:00";
        const m = Math.floor(time / 60);
        const s = Math.floor(time % 60);
        return `${m}:${s.toString().padStart(2, '0')}`;
    };

    return (
        <div className="flex items-center gap-3 min-w-[200px]">
            <audio ref={audioRef} src={src} className="hidden" />

            <button
                onClick={togglePlay}
                className={cn(
                    "w-8 h-8 rounded-full flex items-center justify-center transition-colors shrink-0",
                    isUser ? "bg-primary-foreground/20 hover:bg-primary-foreground/30 text-primary-foreground" : "bg-black/5 dark:bg-white/10 shadow-sm hover:bg-primary/10 text-primary"
                )}
            >
                {isPlaying ? <Pause className="w-4 h-4 fill-current" /> : <Play className="w-4 h-4 fill-current ml-0.5" />}
            </button>

            <div className="flex-1 space-y-1">
                <div className="h-1 bg-current/20 rounded-full overflow-hidden w-full">
                    <div
                        className="h-full bg-current transition-all duration-100 ease-linear rounded-full"
                        style={{ width: `${(currentTime / (duration || 1)) * 100}%` }}
                    />
                </div>
                <div className="flex justify-between items-center text-[10px] opacity-80 font-medium">
                    <span>{formatTime(currentTime)}</span>
                    <span>{formatTime(duration)}</span>
                </div>
            </div>

            <Volume2 className={cn("w-4 h-4 opacity-50 shrink-0", isPlaying && "animate-pulse")} />
        </div>
    );
}

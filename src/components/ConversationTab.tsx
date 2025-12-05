import { Mic, MicOff, Pause, Play, Phone, PhoneOff, Sparkles } from 'lucide-react';
import { useState, useEffect } from 'react';
import { Button } from './ui/button';

export interface SpeechState {
    start: () => void;
    stop: () => void;
    pause: () => void;
    mute: () => void;
    connected: boolean;
    isMuted: boolean;
    isPaused: boolean;
    volume: number;
}

interface ConversationTabProps {
    speechState: SpeechState;
}

export const ConversationTab = ({ speechState }: ConversationTabProps) => {
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
        <div className="flex flex-col h-full bg-background transition-colors duration-300">
            <div className="px-6 py-5 border-b bg-sidebar-accent/10">
                <h2 className="font-semibold text-lg tracking-tight flex items-center gap-2">
                    <Sparkles className="w-4 h-4 text-primary" />
                    Conversation
                </h2>
                <p className="text-sm text-muted-foreground mt-1">Chat with your AI assistant</p>
            </div>

            <div className="flex-1 flex flex-col items-center justify-center p-6 space-y-10">

                {/* Status Indicator & Visualizer */}
                <div className="relative flex flex-col items-center justify-center gap-6">
                    <div className={`relative flex items-center justify-center w-40 h-40 rounded-full transition-all duration-500 ${connected
                        ? 'bg-primary/5 ring-4 ring-primary/20 scale-110'
                        : 'bg-muted/30 scale-100'
                        }`}>
                        {connected ? (
                            <div className="flex items-end justify-center gap-1.5 h-20">
                                {bars.map((height, i) => (
                                    <div
                                        key={i}
                                        className="w-3 bg-primary rounded-full transition-all duration-75 ease-in-out shadow-[0_0_10px_rgba(var(--primary),0.3)]"
                                        style={{
                                            height: `${Math.max(12, height * 80)}px`,
                                            opacity: Math.max(0.4, height)
                                        }}
                                    />
                                ))}
                            </div>
                        ) : (
                            <div className="flex flex-col items-center gap-2 text-muted-foreground/50">
                                <Sparkles className="w-12 h-12" />
                            </div>
                        )}

                        {/* Connection Status Badge */}
                        <div className={`absolute -bottom-3 px-4 py-1.5 rounded-full text-xs font-medium border shadow-sm transition-all duration-300 ${connected
                            ? 'bg-background text-primary border-primary/20 shadow-primary/10'
                            : 'bg-background text-muted-foreground border-border'
                            }`}>
                            {connected ? (isPaused ? 'Paused' : 'Live Session') : 'Ready to start'}
                        </div>
                    </div>
                </div>

                {/* Main Controls */}
                <div className="flex flex-col items-center gap-6 w-full max-w-[280px]">
                    {!connected ? (
                        <Button
                            size="lg"
                            className="w-full h-14 text-base font-medium shadow-lg hover:shadow-xl hover:-translate-y-0.5 transition-all duration-300 rounded-xl"
                            onClick={handleConnectToggle}
                        >
                            <Phone className="w-5 h-5 mr-2" />
                            Start Session
                        </Button>
                    ) : (
                        <div className="w-full space-y-6">
                            <div className="grid grid-cols-2 gap-4">
                                <Button
                                    variant="outline"
                                    size="lg"
                                    onClick={pause}
                                    className={`h-14 rounded-xl border-2 transition-colors ${isPaused
                                        ? 'bg-primary/5 border-primary/20 text-primary'
                                        : 'hover:bg-muted/50'
                                        }`}
                                >
                                    {isPaused ? (
                                        <>
                                            <Play className="w-5 h-5 mr-2" /> Resume
                                        </>
                                    ) : (
                                        <>
                                            <Pause className="w-5 h-5 mr-2" /> Pause
                                        </>
                                    )}
                                </Button>

                                <Button
                                    variant="outline"
                                    size="lg"
                                    onClick={mute}
                                    className={`h-14 rounded-xl border-2 transition-colors ${isMuted
                                        ? 'bg-destructive/5 border-destructive/20 text-destructive'
                                        : 'hover:bg-muted/50'
                                        }`}
                                >
                                    {isMuted ? (
                                        <>
                                            <MicOff className="w-5 h-5 mr-2" /> Unmute
                                        </>
                                    ) : (
                                        <>
                                            <Mic className="w-5 h-5 mr-2" /> Mute
                                        </>
                                    )}
                                </Button>
                            </div>

                            <Button
                                variant="destructive"
                                size="lg"
                                className="w-full h-14 text-base font-medium shadow-lg hover:shadow-red-900/20 hover:-translate-y-0.5 transition-all duration-300 rounded-xl"
                                onClick={stop}
                            >
                                <PhoneOff className="w-5 h-5 mr-2" />
                                End Session
                            </Button>
                        </div>
                    )}
                </div>

                <div className="text-center space-y-2 max-w-[240px]">
                    <p className="text-xs text-muted-foreground/80 leading-relaxed font-medium">
                        {connected
                            ? "Voice is active. Speak clearly to interact."
                            : 'Click "Start Session" to begin real-time voice interaction with your assistant.'
                        }
                    </p>
                </div>
            </div>
        </div>
    );
};

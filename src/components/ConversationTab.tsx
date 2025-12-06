import { Mic, MicOff, Pause, Play, Phone, PhoneOff, Sparkles, Key, Settings, Trash2 } from 'lucide-react';
import { useState } from 'react';
import { Button } from './ui/button';
import { Input } from './ui/input';
import { Label } from './ui/label';
import { Alert, AlertDescription } from "./ui/alert";
import { useSpeechContext } from '../contexts/SpeechContext';
import { MessageList } from './conversation';

export const ConversationTab = () => {
    const {
        token,
        setToken,
        hasToken,
        saveToken,
        start,
        stop,
        pause,
        mute,
        clearMessages,
        connected,
        isMuted,
        isPaused,
        messages
    } = useSpeechContext();

    const [isEditingToken, setIsEditingToken] = useState(false);

    const handleSaveToken = () => {
        saveToken(token);
        setIsEditingToken(false);
    };

    const handleConnectToggle = () => {
        if (connected) {
            stop();
        } else {
            start();
        }
    };

    const handleClearMessages = () => {
        clearMessages();
    };

    return (
        <div className="flex flex-col h-full bg-background transition-colors duration-300 relative overflow-hidden">
            {/* Header */}
            <div className="px-4 py-3 border-b bg-sidebar-accent/5 shrink-0">
                <div className="flex items-center justify-between">
                    <div className="flex items-center gap-2">
                        <div className={`w-2 h-2 rounded-full transition-colors ${connected
                                ? isPaused
                                    ? 'bg-yellow-500'
                                    : 'bg-green-500 animate-pulse'
                                : 'bg-muted-foreground/30'
                            }`} />
                        <h2 className="font-semibold text-sm tracking-tight flex items-center gap-1.5">
                            <Sparkles className="w-3.5 h-3.5 text-primary" />
                            AI Assistant
                        </h2>
                    </div>
                    {messages.length > 0 && (
                        <Button
                            variant="ghost"
                            size="icon"
                            className="h-7 w-7 text-muted-foreground hover:text-destructive"
                            onClick={handleClearMessages}
                            title="Clear conversation"
                        >
                            <Trash2 className="w-3.5 h-3.5" />
                        </Button>
                    )}
                </div>
            </div>

            {/* Messages Area */}
            <div className="flex-1 min-h-0 relative">
                <MessageList messages={messages} className="h-full" />
            </div>

            {/* Controls Footer */}
            <div className="shrink-0 border-t bg-background p-3 space-y-3 z-10">
                {!connected ? (
                    !hasToken || isEditingToken ? (
                        <div className="space-y-3 animate-in fade-in slide-in-from-bottom-2 duration-200">
                            <div className="space-y-1.5">
                                <Label htmlFor="token" className="text-xs font-medium text-muted-foreground flex items-center gap-1">
                                    <Key className="w-3 h-3" />
                                    Access Token
                                </Label>
                                <Input
                                    id="token"
                                    type="password"
                                    placeholder="Enter your Gemini API key"
                                    value={token}
                                    onChange={(e) => setToken(e.target.value)}
                                    className="h-9 text-sm"
                                />
                            </div>

                            <Alert className="bg-yellow-50/50 border-yellow-100 dark:bg-yellow-950/10 dark:border-yellow-900/50 py-1.5">
                                <AlertDescription className="text-yellow-600/90 dark:text-yellow-400/80 text-[10px]">
                                    Stored locally in your browser, never sent to our servers.
                                </AlertDescription>
                            </Alert>

                            <div className="flex gap-2">
                                {hasToken && (
                                    <Button
                                        variant="ghost"
                                        size="sm"
                                        className="flex-1 h-8"
                                        onClick={() => setIsEditingToken(false)}
                                    >
                                        Cancel
                                    </Button>
                                )}
                                <Button
                                    size="sm"
                                    className="flex-1 h-8"
                                    onClick={handleSaveToken}
                                    disabled={!token.trim()}
                                >
                                    Save Token
                                </Button>
                            </div>
                        </div>
                    ) : (
                        <div className="space-y-2">
                            <Button
                                size="sm"
                                className="w-full h-10 text-sm font-medium shadow-sm hover:shadow transition-all rounded-lg"
                                onClick={handleConnectToggle}
                            >
                                <Phone className="w-4 h-4 mr-2" />
                                Start Session
                            </Button>
                            <Button
                                variant="ghost"
                                size="sm"
                                className="w-full h-7 text-[10px] text-muted-foreground hover:text-foreground"
                                onClick={() => setIsEditingToken(true)}
                            >
                                <Settings className="w-3 h-3 mr-1" />
                                Change Access Token
                            </Button>
                        </div>
                    )
                ) : (
                    <div className="space-y-2">
                        {/* Session controls row */}
                        <div className="flex gap-2">
                            <Button
                                variant="outline"
                                size="sm"
                                onClick={pause}
                                className={`flex-1 h-9 rounded-lg transition-colors ${isPaused
                                        ? 'bg-primary/5 border-primary/20 text-primary'
                                        : ''
                                    }`}
                            >
                                {isPaused ? (
                                    <><Play className="w-4 h-4 mr-1.5" /> Resume</>
                                ) : (
                                    <><Pause className="w-4 h-4 mr-1.5" /> Pause</>
                                )}
                            </Button>

                            <Button
                                variant="outline"
                                size="sm"
                                onClick={mute}
                                className={`flex-1 h-9 rounded-lg transition-colors ${isMuted
                                        ? 'bg-destructive/5 border-destructive/20 text-destructive'
                                        : ''
                                    }`}
                            >
                                {isMuted ? (
                                    <><MicOff className="w-4 h-4 mr-1.5" /> Unmute</>
                                ) : (
                                    <><Mic className="w-4 h-4 mr-1.5" /> Mute</>
                                )}
                            </Button>
                        </div>

                        <Button
                            variant="destructive"
                            size="sm"
                            className="w-full h-9 text-sm font-medium shadow-sm transition-all rounded-lg"
                            onClick={stop}
                        >
                            <PhoneOff className="w-4 h-4 mr-2" />
                            End Session
                        </Button>
                    </div>
                )}
            </div>
        </div>
    );
};

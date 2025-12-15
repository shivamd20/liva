import React, { useState, useEffect } from 'react';
import { useParams } from 'react-router-dom';
import { trpcClient } from '../trpcClient';
import { VocalProvider, VocalChat, VocalBackendAdapter } from '@shvm/vocal';
import { Key, Settings, Sparkles } from 'lucide-react';
import { Button } from './ui/button';
import { Input } from './ui/input';
import { Label } from './ui/label';
import { Alert, AlertDescription } from "./ui/alert";

// Helper hook for API Token
function useGeminiToken() {
    const [token, setToken] = useState<string>('');
    useEffect(() => {
        const stored = localStorage.getItem('gemini_api_key');
        if (stored) setToken(stored);
    }, []);

    const saveToken = (newToken: string) => {
        setToken(newToken);
        localStorage.setItem('gemini_api_key', newToken);
    };

    const clearToken = () => {
        setToken('');
        localStorage.removeItem('gemini_api_key');
    };

    return { token, hasToken: !!token, saveToken, clearToken };
}

// Adapter Implementation
const createLivaAdapter = (): VocalBackendAdapter => ({
    getHistory: async (conversationId: string) => {
        const history = await trpcClient.conversation.getHistory.query({ conversationId });
        return history as any;
    },
    append: async (conversationId: string, event: any) => {
        await trpcClient.conversation.append.mutate({
            conversationId,
            type: event.type,
            payload: event.payload,
        });
    },
    summarize: async (conversationId: string) => {
        await trpcClient.conversation.summarize.mutate({ conversationId });
    }
});

interface ConversationProps {
    id?: string;
    className?: string;
    minimal?: boolean;
}

export function ConversationTest({ id: propId, className, minimal = false }: ConversationProps) {
    const { id: paramId } = useParams<{ id: string }>();
    const conversationId = propId || paramId;
    const { token, hasToken, saveToken } = useGeminiToken();
    const [isEditingToken, setIsEditingToken] = useState(false);
    const [tokenInput, setTokenInput] = useState('');

    const [adapter] = useState(() => createLivaAdapter());

    if (!conversationId) {
        return (
            <div className="flex h-full w-full items-center justify-center bg-muted/20 p-8">
                <div className="text-center space-y-4">
                    <div className="bg-muted inline-flex p-4 rounded-full">
                        <Sparkles className="w-8 h-8 text-muted-foreground" />
                    </div>
                    <h3 className="text-lg font-semibold">Select a Conversation</h3>
                </div>
            </div>
        );
    }

    if (!hasToken || isEditingToken) {
        return (
            <div className="flex h-full w-full items-center justify-center bg-background p-4">
                <div className="w-full max-w-md space-y-4 p-6 border rounded-xl bg-card shadow-sm">
                    <div className="space-y-2">
                        <h3 className="font-semibold text-lg flex items-center gap-2">
                            <Key className="w-4 h-4 text-primary" />
                            Configuration Required
                        </h3>
                        <p className="text-sm text-muted-foreground">
                            Enter your Gemini API Key to enable voice and chat features.
                        </p>
                    </div>

                    <div className="space-y-4">
                        <div className="space-y-2">
                            <Label htmlFor="token">API Key</Label>
                            <Input
                                id="token"
                                type="password"
                                placeholder="Gemini API Key..."
                                value={tokenInput}
                                onChange={(e) => setTokenInput(e.target.value)}
                            />
                        </div>

                        <Alert>
                            <AlertDescription className="text-xs">
                                Stored locally in your browser. Never sent to our servers.
                            </AlertDescription>
                        </Alert>

                        <div className="flex gap-2">
                            {hasToken && (
                                <Button variant="ghost" onClick={() => setIsEditingToken(false)} className="flex-1">
                                    Cancel
                                </Button>
                            )}
                            <Button
                                onClick={() => {
                                    if (tokenInput.trim()) {
                                        saveToken(tokenInput.trim());
                                        setIsEditingToken(false);
                                    }
                                }}
                                disabled={!tokenInput.trim()}
                                className="flex-1"
                            >
                                Save Key
                            </Button>
                        </div>
                    </div>
                </div>
            </div>
        );
    }

    return (
        <div className="relative h-full w-full">
            {/* Settings cog overlay */}
            <div className="absolute top-4 right-14 z-50">
                <Button variant="ghost" size="icon" className="h-8 w-8 opacity-50 hover:opacity-100" onClick={() => {
                    setTokenInput(token);
                    setIsEditingToken(true);
                }}>
                    <Settings className="w-4 h-4" />
                </Button>
            </div>

            <VocalProvider
                adapter={adapter}
                config={{
                    apiKey: token,
                    conversationId,
                    systemInstruction: "You are a helpful assistant."
                }}
            >
                <VocalChat
                    className={className}
                    minimal={minimal}
                    title="Voice Conversation"
                />
            </VocalProvider>
        </div>
    );
}

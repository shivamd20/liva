import React, { createContext, useContext, useState, useEffect, ReactNode, RefObject } from 'react';
import { useSpeechToSpeech, UseSpeechToSpeechParams, SpeechState as SpeechHookState } from '../lib/use-speech-to-speech';
import type { ExcalidrawImperativeAPI } from '@excalidraw/excalidraw/types';

// Extended state including token management
export interface SpeechContextType extends SpeechHookState {
    token: string;
    setToken: (token: string) => void;
    hasToken: boolean;
    saveToken: (token: string) => void;
    clearToken: () => void;
}

export const SpeechContext = createContext<SpeechContextType | null>(null);

const STORAGE_KEY = 'gemini_access_token';

interface SpeechProviderProps {
    children: ReactNode;
    excalidrawAPIRef?: RefObject<ExcalidrawImperativeAPI | null>;
    systemInstruction?: string;
}

export const SpeechProvider = ({ children, excalidrawAPIRef, systemInstruction }: SpeechProviderProps) => {
    const [token, setTokenState] = useState<string>('');
    const [hasToken, setHasToken] = useState(false);

    useEffect(() => {
        const stored = localStorage.getItem(STORAGE_KEY);
        if (stored) {
            setTokenState(stored);
            setHasToken(true);
        }
    }, []);

    const saveToken = (newToken: string) => {
        if (newToken.trim()) {
            localStorage.setItem(STORAGE_KEY, newToken.trim());
            setTokenState(newToken.trim());
            setHasToken(true);
        }
    };

    const clearToken = () => {
        localStorage.removeItem(STORAGE_KEY);
        setTokenState('');
        setHasToken(false);
    };

    // Initialize the speech hook only if we have a token (or even if we don't, but it won't connect)
    // We pass the token as apiKey.
    const speechState = useSpeechToSpeech({
        apiKey: token,
        systemInstruction: systemInstruction || "You are a helpful assistant assisting with an Excalidraw board. You can see what the user is drawing in real-time.",
        excalidrawAPIRef,
        frameRate: 1, // 1 FPS for Excalidraw streaming
        onMessage: (text: string) => {
            console.log('Gemini:', text);
        },
        onError: (err: Error) => {
            console.error('Gemini Error:', err);
        }
    });

    const value: SpeechContextType = {
        ...speechState,
        token,
        setToken: setTokenState, // Allow editing the local state before saving
        hasToken,
        saveToken,
        clearToken,
    };

    return (
        <SpeechContext.Provider value={value}>
            {children}
        </SpeechContext.Provider>
    );
};

export const useSpeechContext = () => {
    const context = useContext(SpeechContext);
    if (!context) {
        throw new Error('useSpeechContext must be used within a SpeechProvider');
    }
    return context;
};

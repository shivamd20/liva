export interface VocalEvent {
    id: string;
    timestamp: number;
    type: 'text_in' | 'text_out' | 'audio_in' | 'audio_out' | 'summary' | string;
    payload: string;
    metadata?: any;
}

export interface VocalMessage {
    id: string;
    timestamp: number;
    type: 'user' | 'ai';
    payload: string; // text content or base64 audio
    metadata?: {
        transcript?: string;
        mimeType?: string;
        duration?: number;
    };
}

export interface VocalBackendAdapter {
    getHistory(conversationId: string): Promise<VocalEvent[]>;
    append(conversationId: string, event: Omit<VocalEvent, 'id' | 'timestamp'>): Promise<void>;
    summarize?(conversationId: string): Promise<void>;
}

export interface VocalConfig {
    apiKey: string;
    conversationId: string;
    systemInstruction?: string;
    voiceName?: string;
    model?: string;
}

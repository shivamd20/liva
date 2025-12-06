/**
 * Types for the conversation chatbot interface
 */

export interface BaseMessage {
    id: string;
    timestamp: number;
    type: 'user' | 'ai';
}

export interface AudioMessage extends BaseMessage {
    audioBlob: Blob;           // The audio data for playback
    duration: number;          // Duration in seconds
    transcription?: string;    // Optional transcription if available
}

export interface TextMessage extends BaseMessage {
    type: 'ai';
    content: string;           // Text-only response from AI
}

export type ConversationMessage = AudioMessage | TextMessage;

// Type guard helpers
export function isAudioMessage(msg: ConversationMessage): msg is AudioMessage {
    return 'audioBlob' in msg;
}

export function isTextMessage(msg: ConversationMessage): msg is TextMessage {
    return 'content' in msg && !('audioBlob' in msg);
}

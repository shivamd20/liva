import { useSpeechToSpeech } from '@/lib/use-speech-to-speech';
import React, { useState } from 'react';
import { createRoot } from "react-dom/client";

// --- Components ---

const Visualizer = ({ volume, active }: { volume: number; active: boolean }) => {
    const bars = 5;
    return (
        <div style={{ display: 'flex', gap: '4px', alignItems: 'center', height: '40px' }}>
            {Array.from({ length: bars }).map((_, i) => {
                // Simple visualization logic based on single volume value
                const height = active ? Math.max(10, Math.min(40, volume * 200 * (i + 1) * 0.5 + 10)) : 4;
                return (
                    <div
                        key={i}
                        style={{
                            width: '8px',
                            height: `${height}px`,
                            backgroundColor: active ? '#4285F4' : '#ccc',
                            borderRadius: '4px',
                            transition: 'height 0.1s ease',
                        }}
                    />
                );
            })}
        </div>
    );
};

const DemoTab = ({ title, systemPrompt, voiceName }: { title: string, systemPrompt: string, voiceName: any }) => {
    const { start, stop, pause, mute, connected, isMuted, isPaused, volume } = useSpeechToSpeech({
        apiKey: import.meta.env.VITE_GEMINI_API_KEY,
        systemInstruction: systemPrompt,
        voiceName: voiceName
    });

    return (
        <div style={{ padding: '20px', border: '1px solid #eee', borderRadius: '12px', background: '#fff', boxShadow: '0 2px 8px rgba(0,0,0,0.05)' }}>
            <h3 style={{ margin: '0 0 10px 0', fontSize: '1.2rem', color: '#333' }}>{title}</h3>
            <p style={{ fontSize: '0.9rem', color: '#666', marginBottom: '20px' }}>
                System Prompt: <em>"{systemPrompt}"</em>
            </p>

            <div style={{ display: 'flex', alignItems: 'center', gap: '15px', marginBottom: '20px' }}>
                <div style={{
                    width: '12px',
                    height: '12px',
                    borderRadius: '50%',
                    backgroundColor: connected ? (isPaused ? '#fbbc04' : '#34a853') : '#ea4335'
                }} />
                <span style={{ fontWeight: 'bold', color: '#444' }}>
                    {connected ? (isPaused ? 'Paused' : 'Live') : 'Disconnected'}
                </span>
                <Visualizer volume={volume} active={connected && !isPaused && !isMuted} />
            </div>

            <div style={{ display: 'flex', gap: '10px', flexWrap: 'wrap' }}>
                {!connected ? (
                    <button
                        onClick={() => start()}
                        style={{
                            padding: '10px 20px',
                            backgroundColor: '#4285F4',
                            color: 'white',
                            border: 'none',
                            borderRadius: '8px',
                            cursor: 'pointer',
                            fontWeight: 600
                        }}
                    >
                        Start Conversation
                    </button>
                ) : (
                    <>
                        <button
                            onClick={() => stop()}
                            style={{
                                padding: '10px 20px',
                                backgroundColor: '#ea4335',
                                color: 'white',
                                border: 'none',
                                borderRadius: '8px',
                                cursor: 'pointer',
                                fontWeight: 600
                            }}
                        >
                            Disconnect
                        </button>
                        <button
                            onClick={pause}
                            style={{
                                padding: '10px 20px',
                                backgroundColor: isPaused ? '#fbbc04' : '#f1f3f4',
                                color: isPaused ? 'white' : '#333',
                                border: 'none',
                                borderRadius: '8px',
                                cursor: 'pointer',
                                fontWeight: 600
                            }}
                        >
                            {isPaused ? 'Resume' : 'Pause'}
                        </button>
                        <button
                            onClick={mute}
                            style={{
                                padding: '10px 20px',
                                backgroundColor: isMuted ? '#5f6368' : '#f1f3f4',
                                color: isMuted ? 'white' : '#333',
                                border: 'none',
                                borderRadius: '8px',
                                cursor: 'pointer',
                                fontWeight: 600
                            }}
                        >
                            {isMuted ? 'Unmute Mic' : 'Mute Mic'}
                        </button>
                    </>
                )}
            </div>
        </div>
    );
};



export const SpeechDemo = () => {
    const [activeTab, setActiveTab] = useState(0);

    const tabs = [
        {
            title: "Helpful Assistant",
            prompt: "You are a friendly, helpful, and concise AI assistant. You love to chat about technology.",
            voice: "Zephyr"
        },
        {
            title: "Spanish Tutor",
            prompt: "You are a Spanish language tutor. You speak mostly in Spanish, but explain difficult concepts in English. Correct the user's pronunciation and grammar gently.",
            voice: "Puck"
        },
        {
            title: "Space Pirate",
            prompt: "You are a gritty space pirate captain looking for a crew. You use space slang, you are suspicious but charismatic. You want to find the treasure of Nebula X.",
            voice: "Charon"
        }
    ];

    return (
        <div style={{ fontFamily: 'sans-serif', maxWidth: '800px', margin: '0 auto', padding: '20px' }}>
            <header style={{ marginBottom: '40px', textAlign: 'center' }}>
                <h1 style={{ color: '#202124' }}>Gemini Live: Speech-to-Speech Hook</h1>
                <p style={{ color: '#5f6368' }}>Plug-n-play React hook demo</p>
            </header>

            {/* Tab Navigation */}
            <div style={{ display: 'flex', gap: '10px', marginBottom: '20px', borderBottom: '1px solid #e0e0e0', paddingBottom: '10px' }}>
                {tabs.map((tab, index) => (
                    <button
                        key={index}
                        onClick={() => setActiveTab(index)}
                        style={{
                            padding: '10px 20px',
                            border: 'none',
                            background: 'none',
                            cursor: 'pointer',
                            fontSize: '1rem',
                            fontWeight: activeTab === index ? 'bold' : 'normal',
                            color: activeTab === index ? '#4285F4' : '#5f6368',
                            borderBottom: activeTab === index ? '2px solid #4285F4' : '2px solid transparent',
                            transition: 'all 0.2s'
                        }}
                    >
                        {tab.title}
                    </button>
                ))}
            </div>

            {/* Active Tab Content */}
            {/* We use key={activeTab} to force re-mounting so the hook resets completely between tabs */}
            <DemoTab
                key={activeTab}
                title={tabs[activeTab].title}
                systemPrompt={tabs[activeTab].prompt}
                voiceName={tabs[activeTab].voice}
            />

            <div style={{ marginTop: '50px', padding: '20px', background: '#f8f9fa', borderRadius: '8px', fontSize: '0.85rem', color: '#555' }}>
                <strong>How to use:</strong>
                <pre style={{ overflowX: 'auto', padding: '10px', background: '#fff', borderRadius: '4px', border: '1px solid #eee' }}>
                    {`const { start, stop, pause, mute } = useSpeechToSpeech({
  apiKey: process.env.API_KEY,
  systemInstruction: "You are a pirate..."
});

<button onClick={start}>Start</button>`}
                </pre>
            </div>
        </div>
    );
};

export default SpeechDemo;

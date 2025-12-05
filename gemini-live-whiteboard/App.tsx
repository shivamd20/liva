import React, { useState, useRef, useCallback } from 'react';
import { Whiteboard } from './components/Whiteboard';
import { Controls } from './components/Controls';
import { useGeminiLive } from './hooks/useGeminiLive';
import { ConnectionStatus, WhiteboardHandle } from './types';

const App: React.FC = () => {
  const [volume, setVolume] = useState(0);
  const whiteboardRef = useRef<WhiteboardHandle>(null);
  
  // Wrap in callback to ensure stable reference if needed, 
  // though useGeminiLive handles refs internally now.
  const handleDrawCommand = useCallback((lines: any) => {
    if (whiteboardRef.current) {
      whiteboardRef.current.drawLines(lines);
    }
  }, []);

  const { 
    status, 
    error, 
    connect, 
    disconnect, 
    sendVideoFrame 
  } = useGeminiLive({
    onAudioVolume: (vol) => setVolume(Math.min(100, vol * 2)), 
    onDrawCommand: handleDrawCommand
  });

  return (
    <div className="relative w-screen h-screen bg-gray-950 overflow-hidden flex flex-col">
      {/* Header / Info Overlay */}
      <div className="absolute top-6 left-6 z-10 pointer-events-none select-none">
        <h1 className="text-2xl font-bold bg-clip-text text-transparent bg-gradient-to-r from-blue-400 to-purple-400">
          Gemini Live Whiteboard
        </h1>
        <p className="text-gray-400 text-sm mt-1 max-w-xs">
          Draw and talk. The AI sees what you draw in real-time.
        </p>
      </div>

      {/* Error Toast */}
      {error && (
        <div className="absolute top-6 right-6 z-50 bg-red-500/10 border border-red-500/50 text-red-200 px-4 py-3 rounded-lg backdrop-blur-md max-w-sm">
          <div className="flex items-center gap-2">
            <svg className="w-5 h-5" fill="none" viewBox="0 0 24 24" stroke="currentColor">
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 8v4m0 4h.01M21 12a9 9 0 11-18 0 9 9 0 0118 0z" />
            </svg>
            <p className="text-sm font-medium">{error}</p>
          </div>
        </div>
      )}

      {/* Main Workspace */}
      <div className="flex-1 w-full h-full">
        <Whiteboard 
          ref={whiteboardRef}
          onFrameCapture={sendVideoFrame}
          isActive={status === ConnectionStatus.CONNECTED}
        />
      </div>

      {/* Connection Controls */}
      <Controls 
        status={status}
        volume={volume}
        onConnect={connect}
        onDisconnect={disconnect}
      />
      
      {/* Background hint if disconnected */}
      {status === ConnectionStatus.DISCONNECTED && (
        <div className="absolute inset-0 pointer-events-none flex items-center justify-center">
          <div className="text-gray-700 text-6xl font-black opacity-20 transform -rotate-12 select-none">
            START DRAWING
          </div>
        </div>
      )}
    </div>
  );
};

export default App;
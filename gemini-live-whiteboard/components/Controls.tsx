import React from 'react';
import { ConnectionStatus } from '../types';

interface ControlsProps {
  status: ConnectionStatus;
  volume: number;
  onConnect: () => void;
  onDisconnect: () => void;
}

export const Controls: React.FC<ControlsProps> = ({ status, volume, onConnect, onDisconnect }) => {
  const isConnected = status === ConnectionStatus.CONNECTED;
  const isConnecting = status === ConnectionStatus.CONNECTING;

  // Visualizer bars
  const bars = 5;
  
  return (
    <div className="absolute bottom-8 left-1/2 transform -translate-x-1/2 flex items-center gap-4 z-20">
      <div className={`
        flex items-center gap-4 px-6 py-4 rounded-2xl shadow-2xl border border-gray-700 backdrop-blur-md
        ${isConnected ? 'bg-gray-900/80' : 'bg-gray-800/90'}
      `}>
        {/* Status Indicator / Visualizer */}
        <div className="flex items-center justify-center w-12 h-12 rounded-full bg-gray-800 border border-gray-600 overflow-hidden relative">
           {isConnected ? (
             <div className="flex items-center gap-0.5 h-6">
                {Array.from({ length: bars }).map((_, i) => (
                  <div 
                    key={i}
                    className="w-1 bg-blue-500 rounded-full transition-all duration-75"
                    style={{ 
                      height: `${Math.max(20, Math.min(100, volume * (0.5 + Math.random()) * 2))}%`,
                      opacity: 0.8 
                    }}
                  />
                ))}
             </div>
           ) : (
             <div className={`w-3 h-3 rounded-full ${status === ConnectionStatus.ERROR ? 'bg-red-500' : 'bg-gray-500'}`} />
           )}
        </div>

        <div className="flex flex-col">
          <span className="text-sm font-semibold text-white">
            {isConnected ? 'Gemini Live' : 'Gemini Assistant'}
          </span>
          <span className="text-xs text-gray-400 capitalize">
            {status}
          </span>
        </div>

        <div className="h-8 w-px bg-gray-600 mx-2"></div>

        <button
          onClick={isConnected ? onDisconnect : onConnect}
          disabled={isConnecting}
          className={`
            px-6 py-2 rounded-lg font-medium transition-all duration-200
            ${isConnected 
              ? 'bg-red-500/10 text-red-400 hover:bg-red-500/20 border border-red-500/50' 
              : 'bg-blue-600 text-white hover:bg-blue-500 shadow-lg shadow-blue-900/20'}
            ${isConnecting ? 'opacity-50 cursor-not-allowed' : ''}
          `}
        >
          {isConnecting ? 'Connecting...' : isConnected ? 'Disconnect' : 'Start Session'}
        </button>
      </div>
    </div>
  );
};
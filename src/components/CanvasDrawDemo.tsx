import React, { useRef, useEffect, useState } from 'react';
import { useSpeechToSpeech } from '@/lib/use-speech-to-speech';
import { Pencil, Eraser, Trash2, Mic, MicOff, Wifi, WifiOff, Settings, X } from 'lucide-react';

interface Point {
    x: number;
    y: number;
}

export function CanvasDrawDemo() {
    const canvasRef = useRef<HTMLCanvasElement>(null);
    const [isDrawing, setIsDrawing] = useState(false);
    const [lastPoint, setLastPoint] = useState<Point | null>(null);
    const [tool, setTool] = useState<'pen' | 'eraser'>('pen');
    const [strokeColor, setStrokeColor] = useState('#3b82f6');
    const [lineWidth, setLineWidth] = useState(4);
    const [showSettings, setShowSettings] = useState(false);
    const [apiKey, setApiKey] = useState(() => localStorage.getItem('gemini-api-key') || '');
    const [tempApiKey, setTempApiKey] = useState(apiKey);

    const systemInstruction = `You are a helpful, creative, and enthusiastic AI assistant. 
You can see a canvas that the user is drawing on in real-time. 
The user communicates with you via voice and drawing. 
Comment on what is being drawn, guess what it is, offer suggestions, or just chat casually about the artwork. 
Keep your responses relatively concise and conversational.`;

    const { start, stop, connected, isMuted, mute, volume } = useSpeechToSpeech({
        apiKey,
        canvasRef,
        frameRate: 2,
        systemInstruction,
        voiceName: 'Zephyr',
        onError: (err) => console.error('Speech error:', err),
    });

    // Initialize canvas
    useEffect(() => {
        const canvas = canvasRef.current;
        if (!canvas) return;

        const ctx = canvas.getContext('2d');
        if (!ctx) return;

        const resizeCanvas = () => {
            const parent = canvas.parentElement;
            if (parent) {
                canvas.width = parent.clientWidth;
                canvas.height = parent.clientHeight;
                ctx.lineCap = 'round';
                ctx.lineJoin = 'round';
                // Fill with dark background
                ctx.fillStyle = '#0f172a';
                ctx.fillRect(0, 0, canvas.width, canvas.height);
            }
        };

        resizeCanvas();
        window.addEventListener('resize', resizeCanvas);
        return () => window.removeEventListener('resize', resizeCanvas);
    }, []);

    const getCoordinates = (e: React.MouseEvent | React.TouchEvent): Point | null => {
        const canvas = canvasRef.current;
        if (!canvas) return null;

        const rect = canvas.getBoundingClientRect();
        let clientX, clientY;

        if ('touches' in e) {
            clientX = e.touches[0].clientX;
            clientY = e.touches[0].clientY;
        } else {
            clientX = (e as React.MouseEvent).clientX;
            clientY = (e as React.MouseEvent).clientY;
        }

        return {
            x: clientX - rect.left,
            y: clientY - rect.top
        };
    };

    const startDrawing = (e: React.MouseEvent | React.TouchEvent) => {
        e.preventDefault();
        setIsDrawing(true);
        setLastPoint(getCoordinates(e));
    };

    const draw = (e: React.MouseEvent | React.TouchEvent) => {
        e.preventDefault();
        if (!isDrawing || !lastPoint) return;

        const currentPoint = getCoordinates(e);
        if (!currentPoint) return;

        const canvas = canvasRef.current;
        const ctx = canvas?.getContext('2d');
        if (!ctx || !canvas) return;

        ctx.beginPath();
        ctx.moveTo(lastPoint.x, lastPoint.y);
        ctx.lineTo(currentPoint.x, currentPoint.y);
        ctx.strokeStyle = tool === 'eraser' ? '#0f172a' : strokeColor;
        ctx.lineWidth = tool === 'eraser' ? 20 : lineWidth;
        ctx.stroke();

        setLastPoint(currentPoint);
    };

    const stopDrawing = () => {
        setIsDrawing(false);
        setLastPoint(null);
    };

    const clearCanvas = () => {
        const canvas = canvasRef.current;
        const ctx = canvas?.getContext('2d');
        if (!canvas || !ctx) return;
        ctx.fillStyle = '#0f172a';
        ctx.fillRect(0, 0, canvas.width, canvas.height);
    };

    const handleSaveApiKey = () => {
        localStorage.setItem('gemini-api-key', tempApiKey);
        setApiKey(tempApiKey);
        setShowSettings(false);
    };

    const handleConnect = async () => {
        if (!apiKey) {
            setShowSettings(true);
            return;
        }
        await start();
    };

    const colors = ['#3b82f6', '#ef4444', '#22c55e', '#eab308', '#a855f7', '#ec4899', '#ffffff'];

    return (
        <div className="relative w-screen h-screen bg-slate-950 flex flex-col overflow-hidden">
            {/* Animated Background */}
            <div className="absolute inset-0 z-0 pointer-events-none overflow-hidden">
                <div className="absolute -top-[20%] -left-[10%] w-[50%] h-[50%] bg-blue-500/10 rounded-full blur-3xl animate-pulse" />
                <div className="absolute -bottom-[20%] -right-[10%] w-[50%] h-[50%] bg-purple-500/10 rounded-full blur-3xl animate-pulse" style={{ animationDelay: '1s' }} />
                <div className="absolute top-[40%] left-[60%] w-[30%] h-[30%] bg-cyan-500/5 rounded-full blur-3xl animate-pulse" style={{ animationDelay: '2s' }} />
            </div>

            {/* Header */}
            <header className="relative z-10 flex items-center justify-between p-4 border-b border-slate-800/50 backdrop-blur-sm bg-slate-900/50">
                <div className="flex items-center gap-3">
                    <div className="w-10 h-10 rounded-xl bg-gradient-to-br from-blue-500 to-purple-600 flex items-center justify-center shadow-lg shadow-blue-500/20">
                        <Pencil className="w-5 h-5 text-white" />
                    </div>
                    <div>
                        <h1 className="text-xl font-bold bg-clip-text text-transparent bg-gradient-to-r from-blue-400 via-purple-400 to-pink-400">
                            AI Canvas
                        </h1>
                        <p className="text-xs text-slate-500">Draw & Talk with Gemini</p>
                    </div>
                </div>

                <div className="flex items-center gap-3">
                    {/* Connection Status */}
                    <div className={`flex items-center gap-2 px-3 py-1.5 rounded-full text-sm font-medium transition-all duration-300 ${connected
                            ? 'bg-emerald-500/10 text-emerald-400 border border-emerald-500/30'
                            : 'bg-slate-800/50 text-slate-400 border border-slate-700'
                        }`}>
                        {connected ? <Wifi className="w-4 h-4" /> : <WifiOff className="w-4 h-4" />}
                        {connected ? 'Connected' : 'Disconnected'}
                    </div>

                    {/* Settings Button */}
                    <button
                        onClick={() => setShowSettings(true)}
                        className="p-2.5 rounded-xl bg-slate-800/50 hover:bg-slate-700/50 text-slate-400 hover:text-white transition-all border border-slate-700/50"
                    >
                        <Settings className="w-5 h-5" />
                    </button>
                </div>
            </header>

            {/* Main Content */}
            <main className="relative z-10 flex-1 p-4 flex gap-4">
                {/* Canvas Container */}
                <div className="flex-1 flex flex-col rounded-2xl overflow-hidden border border-slate-800/50 bg-slate-900/30 backdrop-blur-sm shadow-2xl">
                    {/* Toolbar */}
                    <div className="flex items-center justify-between p-3 border-b border-slate-800/50 bg-slate-900/50">
                        <div className="flex items-center gap-2">
                            <button
                                onClick={() => setTool('pen')}
                                className={`p-2.5 rounded-xl transition-all ${tool === 'pen'
                                        ? 'bg-gradient-to-br from-blue-500 to-purple-600 text-white shadow-lg shadow-blue-500/30'
                                        : 'bg-slate-800/50 text-slate-400 hover:bg-slate-700/50 hover:text-white'
                                    }`}
                            >
                                <Pencil className="w-5 h-5" />
                            </button>
                            <button
                                onClick={() => setTool('eraser')}
                                className={`p-2.5 rounded-xl transition-all ${tool === 'eraser'
                                        ? 'bg-gradient-to-br from-blue-500 to-purple-600 text-white shadow-lg shadow-blue-500/30'
                                        : 'bg-slate-800/50 text-slate-400 hover:bg-slate-700/50 hover:text-white'
                                    }`}
                            >
                                <Eraser className="w-5 h-5" />
                            </button>

                            <div className="w-px h-8 bg-slate-700/50 mx-2" />

                            {/* Color Picker */}
                            <div className="flex gap-1.5">
                                {colors.map(color => (
                                    <button
                                        key={color}
                                        onClick={() => { setStrokeColor(color); setTool('pen'); }}
                                        className={`w-7 h-7 rounded-full border-2 transition-all hover:scale-110 ${strokeColor === color && tool === 'pen'
                                                ? 'border-white scale-110 shadow-lg'
                                                : 'border-transparent hover:border-slate-500'
                                            }`}
                                        style={{
                                            backgroundColor: color,
                                            boxShadow: strokeColor === color && tool === 'pen' ? `0 0 12px ${color}60` : undefined
                                        }}
                                    />
                                ))}
                            </div>
                        </div>

                        <button
                            onClick={clearCanvas}
                            className="p-2.5 rounded-xl bg-slate-800/50 text-slate-400 hover:bg-red-500/20 hover:text-red-400 transition-all"
                        >
                            <Trash2 className="w-5 h-5" />
                        </button>
                    </div>

                    {/* Drawing Area */}
                    <div className="flex-1 relative cursor-crosshair touch-none">
                        <canvas
                            ref={canvasRef}
                            className="absolute top-0 left-0 w-full h-full block"
                            onMouseDown={startDrawing}
                            onMouseMove={draw}
                            onMouseUp={stopDrawing}
                            onMouseLeave={stopDrawing}
                            onTouchStart={startDrawing}
                            onTouchMove={draw}
                            onTouchEnd={stopDrawing}
                        />
                    </div>
                </div>
            </main>

            {/* Floating Controls */}
            <div className="absolute bottom-6 left-1/2 -translate-x-1/2 z-20">
                <div className="flex items-center gap-3 px-4 py-3 rounded-2xl bg-slate-900/90 backdrop-blur-xl border border-slate-700/50 shadow-2xl shadow-black/50">
                    {/* Volume Indicator */}
                    {connected && (
                        <div className="flex items-center gap-2 pr-3 border-r border-slate-700/50">
                            <div className="flex gap-0.5 items-end h-5">
                                {[...Array(5)].map((_, i) => (
                                    <div
                                        key={i}
                                        className="w-1 rounded-full bg-gradient-to-t from-blue-500 to-cyan-400 transition-all duration-75"
                                        style={{
                                            height: `${Math.min(100, Math.max(20, volume * 500 * (i + 1) * 0.5))}%`,
                                            opacity: volume > 0.02 * (i + 1) ? 1 : 0.2
                                        }}
                                    />
                                ))}
                            </div>
                            <span className="text-xs text-slate-500">Voice</span>
                        </div>
                    )}

                    {/* Mute Button */}
                    {connected && (
                        <button
                            onClick={mute}
                            className={`p-3 rounded-xl transition-all ${isMuted
                                    ? 'bg-red-500/20 text-red-400 border border-red-500/30'
                                    : 'bg-slate-800/50 text-slate-400 hover:bg-slate-700/50 hover:text-white border border-slate-700/50'
                                }`}
                        >
                            {isMuted ? <MicOff className="w-5 h-5" /> : <Mic className="w-5 h-5" />}
                        </button>
                    )}

                    {/* Connect/Disconnect Button */}
                    <button
                        onClick={connected ? stop : handleConnect}
                        className={`px-6 py-3 rounded-xl font-semibold transition-all flex items-center gap-2 ${connected
                                ? 'bg-red-500/20 text-red-400 hover:bg-red-500/30 border border-red-500/30'
                                : 'bg-gradient-to-r from-blue-500 to-purple-600 text-white hover:from-blue-600 hover:to-purple-700 shadow-lg shadow-blue-500/30'
                            }`}
                    >
                        {connected ? (
                            <>
                                <WifiOff className="w-5 h-5" />
                                Disconnect
                            </>
                        ) : (
                            <>
                                <Wifi className="w-5 h-5" />
                                Start Session
                            </>
                        )}
                    </button>
                </div>
            </div>

            {/* Settings Modal */}
            {showSettings && (
                <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/60 backdrop-blur-sm">
                    <div className="bg-slate-900 rounded-2xl border border-slate-700/50 p-6 w-full max-w-md shadow-2xl">
                        <div className="flex items-center justify-between mb-6">
                            <h2 className="text-xl font-bold text-white">Settings</h2>
                            <button
                                onClick={() => setShowSettings(false)}
                                className="p-2 rounded-lg hover:bg-slate-800 text-slate-400 hover:text-white transition-colors"
                            >
                                <X className="w-5 h-5" />
                            </button>
                        </div>

                        <div className="space-y-4">
                            <div>
                                <label className="block text-sm font-medium text-slate-300 mb-2">
                                    Gemini API Key
                                </label>
                                <input
                                    type="password"
                                    value={tempApiKey}
                                    onChange={(e) => setTempApiKey(e.target.value)}
                                    placeholder="Enter your API key..."
                                    className="w-full px-4 py-3 rounded-xl bg-slate-800/50 border border-slate-700 text-white placeholder-slate-500 focus:outline-none focus:ring-2 focus:ring-blue-500/50 focus:border-blue-500"
                                />
                                <p className="mt-2 text-xs text-slate-500">
                                    Get your API key from{' '}
                                    <a
                                        href="https://aistudio.google.com/apikey"
                                        target="_blank"
                                        rel="noopener noreferrer"
                                        className="text-blue-400 hover:underline"
                                    >
                                        Google AI Studio
                                    </a>
                                </p>
                            </div>

                            <button
                                onClick={handleSaveApiKey}
                                className="w-full py-3 rounded-xl bg-gradient-to-r from-blue-500 to-purple-600 text-white font-semibold hover:from-blue-600 hover:to-purple-700 transition-all shadow-lg shadow-blue-500/30"
                            >
                                Save Settings
                            </button>
                        </div>
                    </div>
                </div>
            )}
        </div>
    );
}

export default CanvasDrawDemo;

import React, { useState, useRef, useCallback } from 'react';
import { trpcClient } from '../trpcClient';
import { Button } from './ui/button';
import { Excalidraw } from '@excalidraw/excalidraw';
import { ExcalidrawImperativeAPI } from '@excalidraw/excalidraw/types';
import { ExcalidrawElement } from '@excalidraw/excalidraw/element/types';
import { Loader2, ArrowRight, Bug, Play } from 'lucide-react';
import { toast } from 'sonner';

export function TestAI() {
    const [query, setQuery] = useState('');
    const [loading, setLoading] = useState(false);
    const [showDebug, setShowDebug] = useState(false);

    // We keep track of the last input/output for inspection
    const [lastInput, setLastInput] = useState<any>(null);
    const [lastOutput, setLastOutput] = useState<any>(null);

    const leftApiRef = useRef<ExcalidrawImperativeAPI | null>(null);
    const rightApiRef = useRef<ExcalidrawImperativeAPI | null>(null);

    const handleGenerate = async () => {
        if (!leftApiRef.current) return;

        setLoading(true);
        try {
            const elements = leftApiRef.current.getSceneElements();
            setLastInput(elements);

            const res = await trpcClient.ai.transformWithAI.mutate({
                query,
                elements: elements as any,
                constraints: {
                    allowDelete: true,
                    allowNewElements: true,
                }
            });

            setLastOutput(res);

            if (res && res.updatedElements && rightApiRef.current) {
                rightApiRef.current.updateScene({
                    elements: res.updatedElements as unknown as ExcalidrawElement[]
                });
                toast.success("AI transformation applied!");
            } else {
                toast.info("No changes returned by AI.");
            }

        } catch (error: any) {
            console.error(error);
            setLastOutput({ error: error.message });
            toast.error("AI request failed: " + error.message);
        } finally {
            setLoading(false);
        }
    };

    return (
        <div className="flex flex-col w-screen h-screen bg-slate-50 dark:bg-slate-950">
            {/* Header / Controls */}
            <div className="bg-white dark:bg-slate-900 border-b border-slate-200 dark:border-slate-800 p-4 shadow-sm z-10">
                <div className="max-w-7xl mx-auto flex flex-col gap-4">
                    <div className="flex items-center justify-between">
                        <h1 className="text-xl font-bold bg-gradient-to-r from-blue-600 to-cyan-500 bg-clip-text text-transparent">
                            AI Board Playground
                        </h1>
                        <div className="flex items-center gap-2">
                            <Button
                                variant="outline"
                                size="sm"
                                onClick={() => setShowDebug(!showDebug)}
                                className="gap-2"
                            >
                                <Bug className="w-4 h-4" />
                                {showDebug ? 'Hide Debug' : 'Show Debug'}
                            </Button>
                        </div>
                    </div>

                    <div className="flex gap-4">
                        <div className="flex-1">
                            <input
                                className="w-full px-4 py-2 rounded-md border border-slate-300 dark:border-slate-700 bg-slate-50 dark:bg-slate-800 focus:ring-2 focus:ring-blue-500 outline-none transition-all"
                                placeholder="Describe how to transform the left board... (e.g., 'Make all rectangles red')"
                                value={query}
                                onChange={(e) => setQuery(e.target.value)}
                                onKeyDown={(e) => e.key === 'Enter' && handleGenerate()}
                            />
                        </div>
                        <Button
                            onClick={handleGenerate}
                            disabled={loading || !query.trim()}
                            className="bg-blue-600 hover:bg-blue-700 text-white min-w-[120px]"
                        >
                            {loading ? (
                                <Loader2 className="w-4 h-4 animate-spin mr-2" />
                            ) : (
                                <Play className="w-4 h-4 mr-2" />
                            )}
                            Generate
                        </Button>
                    </div>
                </div>
            </div>

            {/* Main Content - Split View */}
            <div className="flex-1 flex overflow-hidden relative">
                {/* Left Board - Input */}
                <div className="flex-1 border-r border-slate-200 dark:border-slate-800 relative flex flex-col">
                    <div className="absolute top-4 left-4 z-10 bg-white/90 dark:bg-slate-900/90 backdrop-blur px-3 py-1 rounded-full text-xs font-semibold shadow-sm border border-slate-200 dark:border-slate-700 text-slate-600 dark:text-slate-300 pointer-events-none">
                        Input Board
                    </div>
                    <div className="flex-1 w-full h-full">
                        <Excalidraw
                            excalidrawAPI={(api) => { leftApiRef.current = api; }}
                            initialData={{
                                appState: {
                                    viewBackgroundColor: "#ffffff",
                                    currentItemFontFamily: 1,
                                }
                            }}
                        />
                    </div>
                </div>

                {/* Arrow Indicator */}
                <div className="absolute left-1/2 top-1/2 -translate-x-1/2 -translate-y-1/2 z-20 bg-white dark:bg-slate-800 rounded-full p-2 shadow-lg border border-slate-200 dark:border-slate-700">
                    <ArrowRight className="w-6 h-6 text-slate-400" />
                </div>

                {/* Right Board - Output */}
                <div className="flex-1 relative flex flex-col bg-slate-50 dark:bg-slate-900">
                    <div className="absolute top-4 left-4 z-10 bg-blue-50/90 dark:bg-blue-900/90 backdrop-blur px-3 py-1 rounded-full text-xs font-semibold shadow-sm border border-blue-200 dark:border-blue-800 text-blue-600 dark:text-blue-300 pointer-events-none">
                        AI Output
                    </div>
                    <div className="flex-1 w-full h-full">
                        <Excalidraw
                            excalidrawAPI={(api) => { rightApiRef.current = api; }}
                            initialData={{
                                appState: {
                                    viewBackgroundColor: "#f8fafc", // Slightly different bg to distinguish
                                }
                            }}
                            viewModeEnabled={true} // Start in view mode, but user can unlock if they want to inspect closely
                        />
                    </div>
                </div>
            </div>

            {/* Debug Panel */}
            {showDebug && (
                <div className="h-64 border-t border-slate-200 dark:border-slate-800 bg-slate-50 dark:bg-slate-950 flex overflow-hidden">
                    <div className="flex-1 flex flex-col border-r border-slate-200 dark:border-slate-800 p-4 overflow-hidden">
                        <h3 className="text-xs font-bold uppercase text-slate-500 mb-2">Last Input (JSON)</h3>
                        <pre className="flex-1 overflow-auto text-[10px] font-mono bg-white dark:bg-slate-900 p-2 rounded border border-slate-200 dark:border-slate-800">
                            {lastInput ? JSON.stringify(lastInput, null, 2) : '// No input captured yet'}
                        </pre>
                    </div>
                    <div className="flex-1 flex flex-col p-4 overflow-hidden">
                        <h3 className="text-xs font-bold uppercase text-slate-500 mb-2">Last Output (JSON)</h3>
                        <pre className="flex-1 overflow-auto text-[10px] font-mono bg-white dark:bg-slate-900 p-2 rounded border border-slate-200 dark:border-slate-800">
                            {lastOutput ? JSON.stringify(lastOutput, null, 2) : '// No output received yet'}
                        </pre>
                    </div>
                </div>
            )}
        </div>
    );
}

export default TestAI;

import React, { useState } from 'react';
import { trpcClient } from '../trpcClient';
import { Button } from './ui/button';

export function TestAI() {
    const [query, setQuery] = useState('');
    const [result, setResult] = useState<any>(null);
    const [loading, setLoading] = useState(false);

    const handleTest = async () => {
        setLoading(true);
        try {
            // Mock elements
            const elements = [
                {
                    id: "1",
                    type: "rectangle",
                    x: 100,
                    y: 100,
                    width: 100,
                    height: 100,
                    strokeColor: "#000000",
                    backgroundColor: "transparent",
                    fillStyle: "hachure",
                    strokeWidth: 1,
                    strokeStyle: "solid",
                    roughness: 1,
                    opacity: 100,
                    groupIds: [],
                    frameId: null,
                    roundness: null,
                    seed: 1,
                    version: 1,
                    versionNonce: 1,
                    isDeleted: false,
                    boundElements: null,
                    updated: Date.now(),
                    link: null,
                    locked: false,
                },
                {
                    id: "2",
                    type: "text",
                    x: 300,
                    y: 100,
                    width: 100,
                    height: 20,
                    text: "Hello World",
                    fontSize: 20,
                    fontFamily: 1,
                    textAlign: "left",
                    verticalAlign: "top",
                    baseline: 18,
                    strokeColor: "#000000",
                    backgroundColor: "transparent",
                    fillStyle: "hachure",
                    strokeWidth: 1,
                    strokeStyle: "solid",
                    roughness: 1,
                    opacity: 100,
                    groupIds: [],
                    frameId: null,
                    roundness: null,
                    seed: 2,
                    version: 1,
                    versionNonce: 1,
                    isDeleted: false,
                    boundElements: null,
                    updated: Date.now(),
                    link: null,
                    locked: false,
                }
            ];

            const res = await trpcClient.ai.transformWithAI.mutate({
                query,
                elements: elements as any, // Type assertion for simplicity in test
                constraints: {
                    allowDelete: true,
                    allowNewElements: true,
                }
            });

            setResult(res);
        } catch (error: any) {
            setResult({ error: error.message });
        } finally {
            setLoading(false);
        }
    };

    return (
        <div className="p-8 max-w-4xl mx-auto">
            <div className="bg-white dark:bg-slate-900 shadow rounded-lg p-6">
                <h2 className="text-2xl font-bold mb-4">AI Transformation Test</h2>
                <div className="space-y-4">
                    <div>
                        <label className="block text-sm font-medium mb-2">Query</label>
                        <textarea
                            className="w-full p-2 border rounded-md dark:bg-slate-800 dark:border-slate-700"
                            rows={4}
                            value={query}
                            onChange={(e) => setQuery(e.target.value)}
                            placeholder="e.g., 'Move the rectangle to the right' or 'Change text to red'"
                        />
                    </div>

                    <Button
                        onClick={handleTest}
                        disabled={loading}
                    >
                        {loading ? 'Processing...' : 'Run Test'}
                    </Button>

                    {result && (
                        <div className="mt-8">
                            <h3 className="text-lg font-semibold mb-2">Result</h3>
                            <pre className="bg-slate-950 text-slate-50 p-4 rounded-md overflow-auto max-h-[500px] text-xs">
                                {JSON.stringify(result, null, 2)}
                            </pre>
                        </div>
                    )}
                </div>
            </div>
        </div>
    );
}

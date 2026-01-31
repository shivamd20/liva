import React, { useState } from 'react';
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogDescription } from '@/components/ui/dialog';
import { Button } from '@/components/ui/button';
import { Activity, CheckCircle, XCircle, AlertTriangle, Play, Loader2 } from 'lucide-react';
import type { SanityCheckResult } from '../../../server/code-practice/types';
import { useMutation, useQueryClient } from '@tanstack/react-query';
import { trpcClient } from '../../trpcClient';

interface SanityRunnerModalProps {
    problemId: string | null;
    onClose: () => void;
    onOpenChange: (open: boolean) => void;
}

export function SanityRunnerModal({ problemId, onClose, onOpenChange }: SanityRunnerModalProps) {
    const [result, setResult] = useState<SanityCheckResult | null>(null);

    const queryClient = useQueryClient();
    const sanityMutation = useMutation({
        mutationFn: (input: { problemId: string }) => trpcClient.codePractice.sanityCheck.mutate(input),
        onSuccess: (data: SanityCheckResult) => {
            setResult(data);
            queryClient.invalidateQueries({ queryKey: ['codePractice', 'problems'] }); // Refresh list to show new status
        }
    });

    const handleRun = () => {
        if (!problemId) return;
        setResult(null);
        sanityMutation.mutate({ problemId });
    };

    const getVerdictColor = (verdict: string) => {
        switch (verdict) {
            case 'AC': return 'text-green-500';
            case 'WA': return 'text-red-500';
            case 'CE': return 'text-yellow-500';
            default: return 'text-muted-foreground';
        }
    };

    return (
        <Dialog open={!!problemId} onOpenChange={onOpenChange}>
            <DialogContent className="sm:max-w-md">
                <DialogHeader>
                    <DialogTitle className="flex items-center gap-2">
                        <Activity className="h-5 w-5" />
                        Problem Sanity Check
                    </DialogTitle>
                    <DialogDescription>
                        Verify problem configuration by running Reference Solution (must pass) and Starter Code (usually fails).
                    </DialogDescription>
                </DialogHeader>

                <div className="space-y-6 py-4">

                    {/* Action Area */}
                    <div className="flex justify-center">
                        {!sanityMutation.isPending ? (
                            <Button onClick={handleRun} size="lg" className="w-full">
                                <Play className="mr-2 h-4 w-4" />
                                Run Sanity Check
                            </Button>
                        ) : (
                            <div className="flex flex-col items-center gap-2 text-muted-foreground">
                                <Loader2 className="h-8 w-8 animate-spin text-primary" />
                                <p className="text-sm">Running sanity checks...</p>
                                <div className="text-xs text-muted-foreground/60 w-full text-center">
                                    Executing Reference Solution & Starter Code
                                </div>
                            </div>
                        )}
                    </div>

                    {/* Results Area */}
                    {result && (
                        <div className="space-y-4 border rounded-lg p-4 bg-muted/30 animate-in fade-in zoom-in-95 duration-200">

                            <div className="flex items-center justify-between pb-2 border-b">
                                <span className="font-semibold text-sm">Overall Status</span>
                                <div className={`flex items-center gap-1.5 px-2.5 py-0.5 rounded-full text-sm font-medium ${result.overallStatus === 'passed'
                                    ? 'bg-green-100 text-green-700 dark:bg-green-900/30 dark:text-green-400'
                                    : 'bg-red-100 text-red-700 dark:bg-red-900/30 dark:text-red-400'
                                    }`}>
                                    {result.overallStatus === 'passed' ? <CheckCircle className="h-4 w-4" /> : <XCircle className="h-4 w-4" />}
                                    {result.overallStatus === 'passed' ? 'PASSED' : 'FAILED'}
                                </div>
                            </div>

                            <div className="grid gap-3">
                                {/* Reference Solution Result */}
                                <div className="flex items-center justify-between text-sm">
                                    <div className="flex flex-col">
                                        <span className="font-medium">Reference Solution</span>
                                        <span className="text-xs text-muted-foreground">Expected: AC</span>
                                    </div>
                                    <div className={`font-mono font-medium ${getVerdictColor(result.reference.verdict)}`}>
                                        {result.reference.verdict}
                                    </div>
                                </div>

                                {/* Starter Code Result */}
                                <div className="flex items-center justify-between text-sm">
                                    <div className="flex flex-col">
                                        <span className="font-medium">Starter Code</span>
                                        <span className="text-xs text-muted-foreground">{result.starter.verdict === 'AC' ? 'Warning: Starter Passed!' : 'Normal (Fails)'}</span>
                                    </div>
                                    <div className={`font-mono font-medium ${getVerdictColor(result.starter.verdict)}`}>
                                        {result.starter.verdict}
                                    </div>
                                </div>
                            </div>

                            {result.reference.error && (
                                <div className="mt-2 p-2 bg-red-100/50 dark:bg-red-900/20 text-red-600 text-xs rounded border border-red-200 dark:border-red-900">
                                    <strong>Reference Error:</strong> {result.reference.error}
                                </div>
                            )}
                        </div>
                    )}
                </div>
            </DialogContent>
        </Dialog>
    );
}

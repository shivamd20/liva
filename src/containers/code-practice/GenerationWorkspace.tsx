import { useState, useEffect, useRef } from 'react';
import { useSearchParams, useNavigate } from 'react-router-dom';
import { Button } from '@/components/ui/button';
import { Card } from '@/components/ui/card';
import { Badge } from '@/components/ui/badge';
import { Tabs, TabsContent, TabsList, TabsTrigger } from '@/components/ui/tabs';
import { ArrowLeft, Sparkles, Loader2, CheckCircle, AlertCircle, Check, Code, FileText, Play } from 'lucide-react';
import { cn } from '@/lib/utils';
import ReactMarkdown from 'react-markdown';
import { Prism as SyntaxHighlighter } from 'react-syntax-highlighter';
import { vscDarkPlus } from 'react-syntax-highlighter/dist/esm/styles/prism';
import { trpcClient } from '@/trpcClient';

const START_STREAM_TOKEN = '<<<STREAM_START>>>'; // Unused but good concept
type GenerationPhase = 'problem' | 'execution' | 'finalize' | 'complete';



interface StepConfig {
    id: string;
    label: string;
    icon: any;
    phase: GenerationPhase;
}

const STEPS: StepConfig[] = [
    { id: 'draft', label: 'Problem Statement', icon: FileText, phase: 'problem' },
    { id: 'constraints', label: 'Constraints & Examples', icon: FileText, phase: 'problem' },
    { id: 'tests', label: 'Test Cases', icon: Code, phase: 'execution' },
    { id: 'solution', label: 'Reference Solution', icon: Code, phase: 'execution' },
    { id: 'finalize', label: 'Finalizing', icon: Play, phase: 'finalize' },
];

export default function GenerationWorkspace() {
    const [searchParams] = useSearchParams();
    const navigate = useNavigate();
    const intent = searchParams.get('intent') || '';

    const [currentPhase, setCurrentPhase] = useState<GenerationPhase>('problem');
    const [completedSteps, setCompletedSteps] = useState<Set<string>>(new Set());
    const [isGenerating, setIsGenerating] = useState(false);

    const [problem, setProblem] = useState<any>(null);
    const [execution, setExecution] = useState<any>(null);
    const [finalizedId, setFinalizedId] = useState<string | null>(null);
    const [error, setError] = useState<string | null>(null);

    const hasRun = useRef(false);

    useEffect(() => {
        if (!intent || problem || hasRun.current) return;
        hasRun.current = true;
        runGeneration();
    }, [intent]);

    async function runGeneration() {
        setIsGenerating(true);
        setError(null);

        try {
            // Phase 1: Generate problem
            setCurrentPhase('problem');
            setCompletedSteps(new Set(['draft']));
            setProblem({}); // Reset problem

            console.log('[UI] Starting problem stream...');
            const problemStreamUrl = `/api/code-practice/stream/problem?intent=${encodeURIComponent(intent)}`;

            let problemData: any = {
                examples: [],
                tests: [],
                constraints: [],
                topics: []
            };

            await streamFetch(problemStreamUrl, {}, (line) => {
                const cleaned = cleanLine(line);
                if (!cleaned) return;

                try {
                    const chunk = JSON.parse(cleaned);
                    console.log('[UI][Problem] Chunk:', chunk.type);
                    if (chunk.type === 'metadata') {
                        problemData = { ...problemData, ...chunk };
                    } else if (chunk.type === 'description') {
                        problemData.description = (problemData.description || '') + (chunk.content || '');
                    } else if (chunk.type === 'constraint') {
                        problemData.constraints.push(chunk.content);
                    } else if (chunk.type === 'example') {
                        problemData.examples.push(chunk);
                    } else if (chunk.type === 'test') {
                        problemData.tests.push(chunk);
                    }
                    setProblem({ ...problemData });
                } catch (e) {
                    console.error('[UI][Problem] Failed to parse line:', cleaned, e);
                }
            });

            console.log('[UI] Problem stream complete:', problemData);
            setCompletedSteps(prev => new Set([...prev, 'problem']));

            if (!problemData.tests || problemData.tests.length === 0) {
                console.warn('[UI] No tests generated, skipping implementation...');
                return;
            }

            // Phase 2: Generate execution setup
            setCurrentPhase('execution');
            setCompletedSteps(prev => new Set([...prev, 'tests']));
            setExecution({}); // Reset execution

            console.log('[UI] Starting implementation stream...');
            const implStreamUrl = `/api/code-practice/stream/implementation`;

            let executionData: any = {
                starterCode: '',
            };

            await streamFetch(implStreamUrl, {
                method: 'POST',
                headers: { 'Content-Type': 'application/json' },
                body: JSON.stringify({
                    problem: problemData,
                    tests: problemData.tests,
                    language: 'java'
                })
            }, (line) => {
                const cleaned = cleanLine(line);
                if (!cleaned) return;

                try {
                    const chunk = JSON.parse(cleaned);
                    console.log('[UI][Impl] Chunk:', chunk.type);

                    if (chunk.type === 'starterCode') {
                        executionData.starterCode = chunk.content;
                    } else if (chunk.type === 'referenceSolution') {
                        executionData.referenceSolution = chunk.content;
                        executionData.solution = chunk.content; // Mirror for UI
                    } else if (chunk.type === 'harness' || chunk.type === 'javaHarness') {
                        executionData.harness = chunk.content;
                        console.log('[UI][Impl] Harness received, length:', chunk.content?.length);
                    }
                    setExecution({ ...executionData });
                } catch (e) {
                    console.error('[UI][Impl] Failed to parse line:', cleaned, e);
                }
            });

            console.log('[UI] Implementation stream complete:', executionData);
            setCompletedSteps(prev => new Set([...prev, 'execution']));

            console.log('[UI] Starting Finalization...');
            // Phase 3: Finalize
            // We use the accumulated data
            await finalizeAndVerify(problemData, executionData);

        } catch (err) {
            console.error('Generation error:', err);
            setError(err instanceof Error ? err.message : String(err));
        } finally {
            setIsGenerating(false);
        }
    }

    // Helper for SSE streaming + NDJSON parsing
    async function streamFetch(url: string, options: RequestInit, onLine: (line: string) => void) {
        const res = await fetch(url, options);
        if (!res.ok) throw new Error(`Stream error: ${res.status} ${res.statusText}`);

        const reader = res.body?.getReader();
        if (!reader) throw new Error("No readable stream");

        const decoder = new TextDecoder();
        let sseBuffer = '';
        let ndjsonBuffer = '';

        while (true) {
            const { done, value } = await reader.read();
            if (done) break;

            sseBuffer += decoder.decode(value, { stream: true });
            const sseLines = sseBuffer.split('\n');
            sseBuffer = sseLines.pop() || ''; // Keep incomplete line

            for (const sseLine of sseLines) {
                if (sseLine.startsWith('data: ')) {
                    const dataStr = sseLine.slice(6);
                    try {
                        // The SSE event contains a JSON wrapper from ai.ts: { type: 'text', content: '...' }
                        const eventData = JSON.parse(dataStr);
                        if (eventData.type === 'text' && eventData.content) {
                            // Append the raw text delta from LLM to our NDJSON buffer
                            ndjsonBuffer += eventData.content;

                            // Try to parse complete NDJSON lines from this buffer
                            let boundary = ndjsonBuffer.indexOf('\n');
                            while (boundary !== -1) {
                                const line = ndjsonBuffer.slice(0, boundary).trim();
                                if (line) onLine(line); // Emit complete line

                                ndjsonBuffer = ndjsonBuffer.slice(boundary + 1);
                                boundary = ndjsonBuffer.indexOf('\n');
                            }
                        }
                    } catch (e) {
                        // SSE parse error, ignore
                    }
                }
            }
        }

        // Process remaining buffer if any (unlikely ending with newline but possible)
        if (ndjsonBuffer.trim()) {
            onLine(ndjsonBuffer.trim());
        }
    }

    function cleanLine(line: string): string | null {
        const trimmed = line.trim();
        if (!trimmed) return null;

        // Strip markdown code fences
        if (trimmed.startsWith('```')) return null;
        if (trimmed === '```' || trimmed === '```json') return null;

        // Find the JSON object boundaries.
        // This helps if the model puts valid JSON on the same line as a fence or extra text.
        let start = trimmed.indexOf('{');
        let end = trimmed.lastIndexOf('}');
        if (start !== -1 && end !== -1 && end > start) {
            return trimmed.slice(start, end + 1);
        }

        return null;
    }

    async function finalizeAndVerify(problemData: any, executionData: any) {
        setCurrentPhase('finalize');
        setCompletedSteps(prev => new Set([...prev, 'finalize']));

        try {
            // TODO: Get from auth context
            const userName = 'Test User';

            const result = await trpcClient.codePractice.finalize.mutate({
                problem: problemData,
                execution: executionData,
                userName,
            }) as { success: boolean; problemId: string };

            if (result.success && result.problemId) {
                setFinalizedId(result.problemId);
                setCurrentPhase('complete');
            } else {
                throw new Error('Finalization failed');
            }
        } catch (err) {
            console.error('Finalization error:', err);
            setError(err instanceof Error ? err.message : String(err));
        }
    }

    function getStepStatus(stepId: string): 'pending' | 'active' | 'complete' {
        if (completedSteps.has(stepId)) return 'complete';
        const step = STEPS.find(s => s.id === stepId);
        if (step && step.phase === currentPhase) return 'active';
        return 'pending';
    }

    return (
        <div className="min-h-screen bg-gradient-to-br from-background via-background to-muted/20">
            {/* Header */}
            <div className="border-b bg-background/95 backdrop-blur sticky top-0 z-10">
                <div className="container mx-auto px-6 py-4">
                    <div className="flex items-center justify-between">
                        <div className="flex items-center gap-4">
                            <Button variant="ghost" size="icon" onClick={() => navigate('/practice')}>
                                <ArrowLeft className="w-5 h-5" />
                            </Button>
                            <div>
                                <h1 className="text-xl font-bold flex items-center gap-2">
                                    <Sparkles className="w-5 h-5 text-indigo-500" />
                                    AI Problem Generation
                                </h1>
                                <p className="text-sm text-muted-foreground">{intent}</p>
                            </div>
                        </div>
                        {problem?.title && (
                            <Badge variant="outline">{problem.title}</Badge>
                        )}
                    </div>
                </div>
            </div>

            <div className="container mx-auto px-6 py-8">
                <div className="grid grid-cols-1 lg:grid-cols-4 gap-6">
                    {/* Progress Sidebar */}
                    <div className="lg:col-span-1">
                        <Card className="p-4 sticky top-24">
                            <h3 className="font-semibold mb-4 text-sm uppercase tracking-wide text-muted-foreground">
                                Progress
                            </h3>
                            <div className="space-y-3">
                                {STEPS.map((step, idx) => {
                                    const status = getStepStatus(step.id);
                                    const Icon = step.icon;
                                    return (
                                        <div key={step.id} className="flex items-start gap-3">
                                            <div className={cn(
                                                "w-8 h-8 rounded-full flex items-center justify-center flex-shrink-0 transition-all",
                                                status === 'complete' && "bg-green-500/10 text-green-500 border border-green-500/20",
                                                status === 'active' && "bg-indigo-500/10 text-indigo-500 border border-indigo-500/20 animate-pulse",
                                                status === 'pending' && "bg-muted text-muted-foreground border border-border"
                                            )}>
                                                {status === 'complete' ? (
                                                    <Check className="w-4 h-4" />
                                                ) : status === 'active' ? (
                                                    <Loader2 className="w-4 h-4 animate-spin" />
                                                ) : (
                                                    <Icon className="w-4 h-4" />
                                                )}
                                            </div>
                                            <div className="flex-1 min-w-0">
                                                <p className={cn(
                                                    "text-sm font-medium truncate",
                                                    status !== 'pending' && "text-foreground",
                                                    status === 'pending' && "text-muted-foreground/60"
                                                )}>
                                                    {step.label}
                                                </p>
                                            </div>
                                        </div>
                                    );
                                })}
                            </div>
                        </Card>
                    </div>

                    {/* Main Content */}
                    <div className="lg:col-span-3 space-y-6">
                        {error && (
                            <Card className="p-4 border-destructive bg-destructive/5">
                                <div className="flex items-start gap-3">
                                    <AlertCircle className="w-5 h-5 text-destructive flex-shrink-0 mt-0.5" />
                                    <div>
                                        <p className="font-medium text-destructive">Generation Error</p>
                                        <p className="text-sm text-muted-foreground mt-1">{error}</p>
                                        <Button
                                            size="sm"
                                            variant="outline"
                                            className="mt-3"
                                            onClick={() => window.location.reload()}
                                        >
                                            Try Again
                                        </Button>
                                    </div>
                                </div>
                            </Card>
                        )}

                        {/* Problem */}
                        {problem && (
                            <Card className="p-6">
                                <div className="flex items-center justify-between mb-4">
                                    <h3 className="font-semibold flex items-center gap-2">
                                        Problem
                                        <CheckCircle className="w-4 h-4 text-green-500" />
                                    </h3>
                                    <Badge variant="secondary">{problem.difficulty}</Badge>
                                </div>
                                <h2 className="text-2xl font-bold mb-4">{problem.title}</h2>
                                <div className="prose prose-sm dark:prose-invert max-w-none mb-4">
                                    <ReactMarkdown>{problem.description}</ReactMarkdown>
                                </div>
                                <div className="space-y-4 mt-6">
                                    <div>
                                        <h4 className="font-medium mb-2">Constraints:</h4>
                                        <ul className="list-disc list-inside space-y-1 text-sm text-muted-foreground">
                                            {problem.constraints?.map((c: string, i: number) => (
                                                <li key={i}>{c}</li>
                                            ))}
                                        </ul>
                                    </div>
                                    <div>
                                        <h4 className="font-medium mb-2">Examples:</h4>
                                        {problem.examples?.map((ex: any, i: number) => (
                                            <div key={i} className="bg-muted/50 rounded p-3 mb-2">
                                                <p className="text-sm"><strong>Input:</strong> {typeof ex.input === 'string' ? ex.input : JSON.stringify(ex.input)}</p>
                                                <p className="text-sm"><strong>Output:</strong> {typeof ex.output === 'string' ? ex.output : JSON.stringify(ex.output)}</p>
                                                <p className="text-sm text-muted-foreground">{ex.explanation}</p>
                                            </div>
                                        ))}
                                    </div>
                                </div>
                                <div className="flex gap-2 mt-4">
                                    {problem.topics?.map((topic: string) => (
                                        <Badge key={topic} variant="outline" className="text-xs">{topic}</Badge>
                                    ))}
                                </div>
                            </Card>
                        )}

                        {/* Execution */}
                        {execution && (
                            <Card className="p-6">
                                <div className="flex items-center justify-between mb-4">
                                    <h3 className="font-semibold flex items-center gap-2">
                                        Execution Setup
                                        <CheckCircle className="w-4 h-4 text-green-500" />
                                    </h3>
                                </div>
                                <div className="space-y-4">
                                    <div>
                                        <p className="text-sm"><strong>Time:</strong> {execution.timeComplexity}</p>
                                        <p className="text-sm"><strong>Space:</strong> {execution.spaceComplexity}</p>
                                        <p className="text-sm text-muted-foreground mt-2">
                                            {execution.tests?.length || 0} test cases generated
                                        </p>
                                    </div>
                                </div>
                                <div>
                                    <Tabs defaultValue="solution" className="w-full">
                                        <TabsList className="mb-4">
                                            <TabsTrigger value="solution">Solution</TabsTrigger>
                                            <TabsTrigger value="harness">Harness (Main.java)</TabsTrigger>
                                        </TabsList>
                                        <TabsContent value="solution">
                                            <h4 className="font-medium mb-2">Reference Solution:</h4>
                                            <SyntaxHighlighter
                                                language="java"
                                                style={vscDarkPlus as any}
                                                customStyle={{ borderRadius: '0.5rem', fontSize: '0.875rem', maxHeight: '500px' }}
                                            >
                                                {execution.solution}
                                            </SyntaxHighlighter>
                                        </TabsContent>
                                        <TabsContent value="harness">
                                            <h4 className="font-medium mb-2">Generated Harness:</h4>
                                            <SyntaxHighlighter
                                                language="java"
                                                style={vscDarkPlus as any}
                                                customStyle={{ borderRadius: '0.5rem', fontSize: '0.875rem', maxHeight: '500px' }}
                                            >
                                                {execution.harness || "// Harness code not available"}
                                            </SyntaxHighlighter>
                                        </TabsContent>
                                    </Tabs>
                                </div>
                            </Card>
                        )}

                        {/* Finalization */}
                        {currentPhase === 'finalize' || currentPhase === 'complete' ? (
                            <Card className="p-8">
                                <div className="flex flex-col items-center justify-center text-center">
                                    {finalizedId ? (
                                        <>
                                            <div className="w-16 h-16 rounded-full bg-green-500/10 flex items-center justify-center mb-4 border border-green-500/20">
                                                <CheckCircle className="w-8 h-8 text-green-500" />
                                            </div>
                                            <h2 className="text-2xl font-bold mb-2">Problem Generated!</h2>
                                            <p className="text-muted-foreground max-w-md mb-6">
                                                Successfully created and running sanity checks.
                                            </p>
                                            <div className="flex gap-4">
                                                <Button size="lg" onClick={() => navigate(`/practice/${finalizedId}`)}>
                                                    Open Problem
                                                </Button>
                                                <Button size="lg" variant="outline" onClick={() => navigate('/practice')}>
                                                    Back to Library
                                                </Button>
                                            </div>
                                        </>
                                    ) : (
                                        <>
                                            <Loader2 className="w-12 h-12 animate-spin text-indigo-500 mb-4" />
                                            <h2 className="text-xl font-semibold mb-2">Finalizing...</h2>
                                            <p className="text-muted-foreground">Saving and running sanity checks</p>
                                        </>
                                    )}
                                </div>
                            </Card>
                        ) : null}
                    </div>
                </div>
            </div>
        </div >
    );
}

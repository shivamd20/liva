/**
 * ProblemSolvePage - Split-view problem solving interface with resizable panels
 */

import { useState, useCallback, useEffect, useRef } from 'react';
import { useParams, useNavigate } from 'react-router-dom';
import { useProblem, useDraft, useSaveDraft, useRunCode, useSubmitCode, useSubmissions, useProblems } from '../../hooks/useCodePractice';
import { CodeEditor } from './CodeEditor';
import { ResultsPanel } from './ResultsPanel';
import { ProblemDescription } from './ProblemDescription';
import { Button } from '../ui/button';
import { Badge } from '../ui/badge';
import { Tabs, TabsContent, TabsList, TabsTrigger } from '../ui/tabs';
import { ResizablePanelGroup, ResizablePanel, ResizableHandle } from '../ui/resizable';
import { ArrowLeft, Play, Send, Loader2, FileText, History, TestTube, Plus, Trash2, LayoutTemplate, SquareChartGantt, RotateCcw } from 'lucide-react';
import type { ExecutionResult } from '../../hooks/useCodePractice';

type Language = 'java' | 'javascript' | 'typescript' | 'python';

const SUPPORTED_LANGUAGES: { value: Language; label: string; disabled: boolean }[] = [
  { value: 'java', label: 'Java', disabled: false },
  { value: 'javascript', label: 'JavaScript', disabled: true },
  { value: 'typescript', label: 'TypeScript', disabled: true },
  { value: 'python', label: 'Python', disabled: true },
];

interface CustomTestCase {
  id: string;
  input: string;
  expectedOutput?: string;
}

type TestCaseItem =
  | { type: 'visible'; id: string; index: number; input: unknown; expected: unknown; description?: string }
  | { type: 'custom'; id: string; index: number; input: string; expectedOutput?: string };

export default function ProblemSolvePage() {
  const { problemId } = useParams<{ problemId: string }>();
  const navigate = useNavigate();

  const [language, setLanguage] = useState<Language>('java');
  const [code, setCode] = useState<string>('');
  const [result, setResult] = useState<ExecutionResult | null>(null);
  const [isInitialized, setIsInitialized] = useState(false);
  const [isLocalStorageLoaded, setIsLocalStorageLoaded] = useState(false);

  // Tabs state
  const [leftTab, setLeftTab] = useState('description');
  const [consoleTab, setConsoleTab] = useState('testcases');

  const [customTestCases, setCustomTestCases] = useState<CustomTestCase[]>([]);
  const [isConsoleCollapsed, setIsConsoleCollapsed] = useState(false);

  // Queries
  const { data: problemsList } = useProblems();
  const { data: problem, isLoading: problemLoading } = useProblem(problemId);
  const { data: draftData, isLoading: draftLoading, isFetched: draftFetched } = useDraft(problemId, language);
  const { data: submissionsData, isLoading: submissionsLoading } = useSubmissions(problemId, 10);

  const saveDraft = useSaveDraft();
  const runCode = useRunCode();
  const submitCode = useSubmitCode();

  // Debounce timer ref
  const saveTimerRef = useRef<NodeJS.Timeout | null>(null);
  const consolePanelRef = useRef<any>(null);

  // Generate starter code
  const generateStarterCode = useCallback(() => {
    if (!problem) return '';

    if (problem.starterCode?.java) {
      return problem.starterCode.java;
    }

    if (!problem.functionSignature) return '';

    const sig = problem.functionSignature;
    const params = sig.params.map(p => {
      const javaType = typeSpecToJava(p.type);
      return `${javaType} ${p.name}`;
    }).join(', ');

    const returnType = typeSpecToJava(sig.returnType);

    return `class Solution {
    public ${returnType} ${sig.name}(${params}) {
        // Your code here
        
    }
}`;
  }, [problem]);

  // Initialize code
  useEffect(() => {
    if (problemLoading || isLocalStorageLoaded) return;

    // 1. Try Local Storage first
    if (problemId) {
      const key = `code-practice-draft-${problemId}-${language}`;
      const stored = localStorage.getItem(key);
      if (stored) {
        setCode(stored);
        setIsInitialized(true);
        setIsLocalStorageLoaded(true);
        return;
      }
    }

    // 2. Try Server Draft
    if (!draftFetched) return;

    if (!isInitialized && problem) {
      if (draftData?.code) {
        setCode(draftData.code);
      } else {
        const starter = generateStarterCode();
        setCode(starter);
      }
      setIsInitialized(true);
      setIsLocalStorageLoaded(true);
    }
  }, [problemLoading, draftFetched, draftData, generateStarterCode, isInitialized, problem, problemId, language, isLocalStorageLoaded]);

  // Reset when language or problem changes
  useEffect(() => {
    setIsInitialized(false);
    setIsLocalStorageLoaded(false);
    setResult(null);
    setCustomTestCases([]);
    setLeftTab('description');
    setConsoleTab('testcases');
  }, [language, problemId]);

  // Auto-save draft
  const handleCodeChange = useCallback((newCode: string) => {
    setCode(newCode);

    if (problemId) {
      localStorage.setItem(`code-practice-draft-${problemId}-${language}`, newCode);
    }

    if (saveTimerRef.current) {
      clearTimeout(saveTimerRef.current);
    }

    saveTimerRef.current = setTimeout(() => {
      if (problemId && newCode.trim()) {
        saveDraft.mutate({ problemId, language, code: newCode });
      }
    }, 1000);
  }, [problemId, language, saveDraft]);

  const handleRestore = useCallback(() => {
    if (!confirm('Are you sure you want to reset the code to the starter template? This will lose your changes.')) return;

    const starter = generateStarterCode();
    setCode(starter);
    if (problemId) {
      localStorage.removeItem(`code-practice-draft-${problemId}-${language}`);
      saveDraft.mutate({ problemId, language, code: starter });
    }
    setResult(null);
    setConsoleTab('testcases');
  }, [generateStarterCode, problemId, language, saveDraft]);

  useEffect(() => {
    return () => {
      if (saveTimerRef.current) {
        clearTimeout(saveTimerRef.current);
      }
    };
  }, []);

  const handleRun = useCallback(async () => {
    if (!problemId || !code.trim()) return;

    setResult(null);
    setConsoleTab('results');

    // Auto expand console if collapsed
    if (consolePanelRef.current) {
      consolePanelRef.current.expand();
    }

    try {
      const res = await runCode.mutateAsync({ problemId, code, language });
      setResult(res);
    } catch (error) {
      console.error('Run error:', error);
    }
  }, [problemId, code, language, runCode]);

  const handleSubmit = useCallback(async () => {
    if (!problemId || !code.trim()) return;

    setResult(null);
    setConsoleTab('results');

    // Auto expand console if collapsed
    if (consolePanelRef.current) {
      consolePanelRef.current.expand();
    }

    try {
      const res = await submitCode.mutateAsync({ problemId, code, language });
      setResult(res);
    } catch (error) {
      console.error('Submit error:', error);
    }
  }, [problemId, code, language, submitCode]);

  // Navigation handlers
  const handleNext = useCallback(() => {
    if (!problemsList || !problem) {
      navigate('/practice');
      return;
    }
    const currentIndex = problemsList.findIndex(p => p.problemId === problem.problemId);
    if (currentIndex !== -1 && currentIndex < problemsList.length - 1) {
      navigate(`/practice/${problemsList[currentIndex + 1].problemId}`);
    } else {
      navigate('/practice');
    }
  }, [problemsList, problem, navigate]);

  const handleRetry = useCallback(() => {
    setResult(null);
    setConsoleTab('testcases');
  }, []);

  // Test Case Handlers
  const addCustomTestCase = useCallback(() => {
    const newTestCase: CustomTestCase = {
      id: crypto.randomUUID(),
      input: '',
      expectedOutput: '',
    };
    setCustomTestCases(prev => [...prev, newTestCase]);
  }, []);

  const removeCustomTestCase = useCallback((id: string) => {
    setCustomTestCases(prev => prev.filter(tc => tc.id !== id));
  }, []);

  const updateCustomTestCase = useCallback((id: string, field: 'input' | 'expectedOutput', value: string) => {
    setCustomTestCases(prev => prev.map(tc =>
      tc.id === id ? { ...tc, [field]: value } : tc
    ));
  }, []);

  const isRunning = runCode.isPending || submitCode.isPending;

  if (problemLoading) {
    return (
      <div className="min-h-screen bg-background flex items-center justify-center">
        <Loader2 className="h-8 w-8 animate-spin text-muted-foreground" />
      </div>
    );
  }

  if (!problem) {
    return (
      <div className="min-h-screen bg-background flex flex-col items-center justify-center">
        <p className="text-muted-foreground mb-4">Problem not found</p>
        <Button onClick={() => navigate('/practice')}>Back to Problems</Button>
      </div>
    );
  }

  return (
    <div className="h-screen flex flex-col bg-background overflow-hidden">
      {/* Header */}
      <header className="h-14 border-b border-border/40 bg-background/95 backdrop-blur px-4 flex items-center justify-between shrink-0 z-10">
        <div className="flex items-center gap-4">
          <Button variant="ghost" size="icon" onClick={() => navigate('/practice')} className="-ml-2">
            <ArrowLeft className="h-5 w-5" />
          </Button>
          <div className="flex items-center gap-2">
            <h1 className="font-semibold text-lg">{problem.title}</h1>
            <DifficultyBadge difficulty={problem.difficulty} />
          </div>
        </div>

        <div className="flex items-center gap-3">
          <select
            value={language}
            onChange={(e) => setLanguage(e.target.value as Language)}
            className="h-9 px-3 rounded-md border border-input bg-background text-sm focus:outline-none focus:ring-1 focus:ring-ring"
          >
            {SUPPORTED_LANGUAGES.map((lang) => (
              <option key={lang.value} value={lang.value} disabled={lang.disabled}>
                {lang.label} {lang.disabled && '(Coming Soon)'}
              </option>
            ))}
          </select>

          <Button
            variant="ghost"
            size="icon"
            onClick={handleRestore}
            title="Reset to starter code"
            className="text-muted-foreground hover:text-foreground"
          >
            <RotateCcw className="h-4 w-4" />
          </Button>

          <div className="h-4 w-px bg-border/60 mx-1" />

          <Button
            variant="secondary"
            size="sm"
            onClick={handleRun}
            disabled={isRunning || !code.trim()}
          >
            {runCode.isPending ? (
              <Loader2 className="h-4 w-4 mr-2 animate-spin" />
            ) : (
              <Play className="h-4 w-4 mr-2" />
            )}
            Run
          </Button>
          <Button
            size="sm"
            onClick={handleSubmit}
            disabled={isRunning || !code.trim()}
            className="bg-green-600 hover:bg-green-700 text-white"
          >
            {submitCode.isPending ? (
              <Loader2 className="h-4 w-4 mr-2 animate-spin" />
            ) : (
              <Send className="h-4 w-4 mr-2" />
            )}
            Submit
          </Button>
        </div>
      </header>

      {/* Main Content Area */}
      <div className="flex-1 min-h-0">
        <ResizablePanelGroup orientation="horizontal" className="h-full">
          {/* Left Panel: Problem Information - Initial 40% */}
          <ResizablePanel defaultSize={40} minSize={20} className="bg-card min-w-0">
            <Tabs value={leftTab} onValueChange={setLeftTab} className="h-full flex flex-col min-w-0">
              <div className="border-b border-border/40 px-2 flex items-center bg-muted/20 shrink-0">
                <TabsList className="bg-transparent h-10 p-0">
                  <TabsTrigger
                    value="description"
                    className="h-10 rounded-none border-b-2 border-transparent data-[state=active]:border-primary data-[state=active]:bg-transparent px-4 gap-2"
                  >
                    <FileText className="h-4 w-4" />
                    Description
                  </TabsTrigger>
                  <TabsTrigger
                    value="submissions"
                    className="h-10 rounded-none border-b-2 border-transparent data-[state=active]:border-primary data-[state=active]:bg-transparent px-4 gap-2"
                  >
                    <History className="h-4 w-4" />
                    Submissions
                  </TabsTrigger>
                </TabsList>
              </div>

              <div className="flex-1 overflow-hidden relative min-w-0">
                <TabsContent value="description" className="h-full m-0 overflow-y-auto custom-scrollbar">
                  <div className="p-0 min-w-0">
                    <ProblemDescription problem={problem} />
                  </div>
                </TabsContent>
                <TabsContent value="submissions" className="h-full m-0 overflow-y-auto custom-scrollbar p-4">
                  <SubmissionsHistory
                    submissions={submissionsData?.submissions}
                    isLoading={submissionsLoading}
                  />
                </TabsContent>
              </div>
            </Tabs>
          </ResizablePanel>

          <ResizableHandle withHandle />

          {/* Right Panel: Editor & Console - 60% */}
          <ResizablePanel defaultSize={60} minSize={20} className="min-w-0">
            <ResizablePanelGroup orientation="vertical">
              {/* Code Editor */}
              <ResizablePanel defaultSize={60} minSize={10} className="relative min-h-0">
                <div className="h-full flex flex-col">
                  {/* Editor Toolbar/Header could go here if needed, but simple is better */}
                  <div className="flex-1 min-h-0">
                    <CodeEditor
                      code={code}
                      language={language}
                      onChange={handleCodeChange}
                      onRun={handleRun}
                    />
                  </div>
                </div>
              </ResizablePanel>

              <ResizableHandle withHandle />

              {/* Console / Testcases Panel */}
              <ResizablePanel
                ref={consolePanelRef}
                defaultSize={40}
                minSize={10}
                collapsible={true}
                collapsedSize={4}
                onResize={(size) => {
                  const isCollapsed = (size as unknown as number) <= 5;
                  if (isConsoleCollapsed !== isCollapsed) {
                    setIsConsoleCollapsed(isCollapsed);
                  }
                }}
                className={isConsoleCollapsed ? "bg-muted/10 transition-colors duration-200" : "bg-card transition-colors duration-200"}
              >
                <Tabs value={consoleTab} onValueChange={setConsoleTab} className="h-full flex flex-col">
                  <div className="border-t border-b border-border/40 px-2 bg-muted/20 flex items-center justify-between h-10 shrink-0">
                    <div className="flex items-center">
                      <Button
                        variant="ghost"
                        size="sm"
                        onClick={() => {
                          if (isConsoleCollapsed) {
                            consolePanelRef.current?.expand();
                          } else {
                            consolePanelRef.current?.collapse();
                          }
                        }}
                        className="h-8 w-8 p-0 mr-2"
                        title={isConsoleCollapsed ? "Expand Console" : "Collapse Console"}
                      >
                        {isConsoleCollapsed ? <SquareChartGantt className="h-4 w-4 rotate-180" /> : <LayoutTemplate className="h-4 w-4" />}
                      </Button>

                      {!isConsoleCollapsed && (
                        <TabsList className="bg-transparent h-10 p-0">
                          <TabsTrigger
                            value="testcases"
                            className="h-10 rounded-none border-b-2 border-transparent data-[state=active]:border-primary data-[state=active]:bg-transparent px-4 gap-2"
                          >
                            <TestTube className="h-4 w-4" />
                            Testcases
                          </TabsTrigger>
                          <TabsTrigger
                            value="results"
                            className="h-10 rounded-none border-b-2 border-transparent data-[state=active]:border-primary data-[state=active]:bg-transparent px-4 gap-2"
                          >
                            Result
                            {result && (
                              <Badge
                                variant="outline"
                                className={`ml-2 text-[10px] h-4 px-1 ${result.verdict === 'AC'
                                  ? 'text-green-500 border-green-500/30'
                                  : 'text-red-500 border-red-500/30'
                                  }`}
                              >
                                {result.verdict}
                              </Badge>
                            )}
                          </TabsTrigger>
                        </TabsList>
                      )}
                    </div>

                    {isConsoleCollapsed && (
                      <span className="text-xs text-muted-foreground mr-auto ml-2 font-medium">Console</span>
                    )}
                  </div>

                  {!isConsoleCollapsed && (
                    <div className="flex-1 overflow-hidden">
                      <TabsContent value="testcases" className="h-full m-0 overflow-y-auto custom-scrollbar">
                        <TestcasesPanel
                          problem={problem}
                          customTestCases={customTestCases}
                          onAddTestCase={addCustomTestCase}
                          onRemoveTestCase={removeCustomTestCase}
                          onUpdateTestCase={updateCustomTestCase}
                        />
                      </TabsContent>

                      <TabsContent value="results" className="h-full m-0 overflow-y-auto custom-scrollbar">
                        <ResultsPanel
                          result={result}
                          isLoading={isRunning}
                          onRetry={handleRetry}
                          onNext={handleNext}
                        />
                      </TabsContent>
                    </div>
                  )}
                </Tabs>
              </ResizablePanel>
            </ResizablePanelGroup>
          </ResizablePanel>
        </ResizablePanelGroup>
      </div>
    </div>
  );
}

function DifficultyBadge({ difficulty }: { difficulty: string }) {
  const colors: Record<string, string> = {
    easy: 'bg-green-500/10 text-green-500 border-green-500/20',
    medium: 'bg-yellow-500/10 text-yellow-500 border-yellow-500/20',
    hard: 'bg-red-500/10 text-red-500 border-red-500/20',
  };

  return (
    <Badge variant="outline" className={colors[difficulty] || ''}>
      {difficulty.charAt(0).toUpperCase() + difficulty.slice(1)}
    </Badge>
  );
}

// Testcases panel component
interface TestcasesPanelProps {
  problem: NonNullable<ReturnType<typeof useProblem>['data']>;
  customTestCases: CustomTestCase[];
  onAddTestCase: () => void;
  onRemoveTestCase: (id: string) => void;
  onUpdateTestCase: (id: string, field: 'input' | 'expectedOutput', value: string) => void;
}

function TestcasesPanel({
  problem,
  customTestCases,
  onAddTestCase,
  onRemoveTestCase,
  onUpdateTestCase
}: TestcasesPanelProps) {
  const [activeCase, setActiveCase] = useState(0);

  // Combine visible tests from problem with custom test cases
  const visibleTests = problem.tests?.filter(t => t.visibility === 'visible') || [];

  const allCases: TestCaseItem[] = [
    ...visibleTests.map((t, i) => ({
      type: 'visible' as const,
      id: t.testId,
      index: i,
      input: t.input,
      expected: t.expected,
      description: t.description,
    })),
    ...customTestCases.map((tc, i) => ({
      type: 'custom' as const,
      id: tc.id,
      index: visibleTests.length + i,
      input: tc.input,
      expectedOutput: tc.expectedOutput,
    })),
  ];

  return (
    <div className="p-4 space-y-4">
      {/* Case selector */}
      <div className="flex items-center gap-2 flex-wrap">
        {allCases.map((testCase, idx) => (
          <Button
            key={testCase.id}
            variant={activeCase === idx ? 'default' : 'outline'}
            size="sm"
            onClick={() => setActiveCase(idx)}
            className="min-w-[80px]"
          >
            {testCase.type === 'custom' ? `Custom ${idx - visibleTests.length + 1}` : `Case ${idx + 1}`}
          </Button>
        ))}
        <Button
          variant="outline"
          size="sm"
          onClick={onAddTestCase}
          className="gap-1"
        >
          <Plus className="h-4 w-4" />
          Add
        </Button>
      </div>

      {allCases[activeCase] && (
        <div className="space-y-3">
          {allCases[activeCase].type === 'visible' ? (
            <VisibleTestCaseDetail testCase={allCases[activeCase] as Extract<TestCaseItem, { type: 'visible' }>} />
          ) : (
            <CustomTestCaseDetail
              testCase={allCases[activeCase] as Extract<TestCaseItem, { type: 'custom' }>}
              onUpdate={onUpdateTestCase}
              onRemove={onRemoveTestCase}
            />
          )}
        </div>
      )}

      {allCases.length === 0 && (
        <div className="text-center py-8 text-muted-foreground">
          <TestTube className="h-8 w-8 mx-auto mb-2 opacity-50" />
          <p>No test cases available</p>
          <Button
            variant="outline"
            size="sm"
            onClick={onAddTestCase}
            className="mt-2 gap-1"
          >
            <Plus className="h-4 w-4" />
            Add Custom Test Case
          </Button>
        </div>
      )}
    </div>
  );
}

function VisibleTestCaseDetail({ testCase }: { testCase: Extract<TestCaseItem, { type: 'visible' }> }) {
  return (
    <>
      <div>
        <label className="text-sm font-medium text-muted-foreground mb-1 block">Input</label>
        <div className="rounded-md bg-muted/50 p-3 font-mono text-sm overflow-x-auto">
          {formatTestInput(testCase.input as any)}
        </div>
      </div>
      <div>
        <label className="text-sm font-medium text-muted-foreground mb-1 block">Expected Output</label>
        <div className="rounded-md bg-muted/50 p-3 font-mono text-sm overflow-x-auto">
          {formatOutput(testCase.expected)}
        </div>
      </div>
      {testCase.description && (
        <div>
          <label className="text-sm font-medium text-muted-foreground mb-1 block">Description</label>
          <p className="text-sm text-muted-foreground">{testCase.description}</p>
        </div>
      )}
    </>
  );
}

function CustomTestCaseDetail({
  testCase,
  onUpdate,
  onRemove
}: {
  testCase: Extract<TestCaseItem, { type: 'custom' }>;
  onUpdate: (id: string, field: 'input' | 'expectedOutput', value: string) => void;
  onRemove: (id: string) => void;
}) {
  return (
    <>
      <div>
        <div className="flex items-center justify-between mb-1">
          <label className="text-sm font-medium text-muted-foreground">Input</label>
          <Button
            variant="ghost"
            size="sm"
            onClick={() => onRemove(testCase.id)}
            className="h-6 text-muted-foreground hover:text-destructive"
          >
            <Trash2 className="h-4 w-4" />
          </Button>
        </div>
        <textarea
          className="w-full h-20 rounded-md bg-muted/50 p-3 font-mono text-sm border border-input resize-none focus:outline-none focus:ring-2 focus:ring-ring"
          placeholder="Enter test input (JSON format)..."
          value={testCase.input}
          onChange={(e) => onUpdate(testCase.id, 'input', e.target.value)}
        />
      </div>
      <div>
        <label className="text-sm font-medium text-muted-foreground mb-1 block">Expected Output (optional)</label>
        <textarea
          className="w-full h-20 rounded-md bg-muted/50 p-3 font-mono text-sm border border-input resize-none focus:outline-none focus:ring-2 focus:ring-ring"
          placeholder="Enter expected output (JSON format)..."
          value={testCase.expectedOutput || ''}
          onChange={(e) => onUpdate(testCase.id, 'expectedOutput', e.target.value)}
        />
      </div>
    </>
  )
}

function SubmissionsHistory({ submissions, isLoading }: { submissions?: any[], isLoading: boolean }) {
  if (isLoading) {
    return (
      <div className="flex items-center justify-center py-8">
        <Loader2 className="h-6 w-6 animate-spin text-muted-foreground" />
      </div>
    );
  }

  if (!submissions || submissions.length === 0) {
    return (
      <div className="text-center py-8 text-muted-foreground">
        <History className="h-8 w-8 mx-auto mb-2 opacity-50" />
        <p>No submissions yet</p>
        <p className="text-sm">Your submission history will appear here</p>
      </div>
    );
  }

  return (
    <div className="space-y-2">
      {submissions.map((submission) => (
        <div
          key={submission.id}
          className={`rounded-lg border p-3 ${submission.verdict === 'AC'
            ? 'border-green-500/20 bg-green-500/5'
            : 'border-red-500/20 bg-red-500/5'
            }`}
        >
          <div className="flex items-center justify-between">
            <div className="flex items-center gap-2">
              <Badge
                variant="outline"
                className={`${submission.verdict === 'AC'
                  ? 'text-green-500 border-green-500/30'
                  : 'text-red-500 border-red-500/30'
                  }`}
              >
                {submission.verdict}
              </Badge>
              <span className="text-sm text-muted-foreground">
                {Math.round(submission.score * 100)}% passed
              </span>
            </div>
            <div className="text-xs text-muted-foreground">
              {new Date(submission.submittedAt).toLocaleString()}
            </div>
          </div>
          <div className="mt-1 text-xs text-muted-foreground">
            Runtime: {submission.timeMs !== null ? `${submission.timeMs}ms` : 'N/A'}
          </div>
        </div>
      ))}
    </div>
  );
}



function formatTestInput(input: unknown): string {
  if (Array.isArray(input)) {
    return input.map(item => formatOutput(item)).join(', ');
  }
  return formatOutput(input);
}

function formatOutput(value: unknown): string {
  if (value === null) return 'null';
  if (value === undefined) return 'undefined';
  if (typeof value === 'string') return value;
  try {
    return JSON.stringify(value);
  } catch {
    return String(value);
  }
}

// Helper to convert TypeSpec to Java type string
function typeSpecToJava(typeSpec: any): string {
  // Handle Zod/Object type specs
  if (typeSpec && typeof typeSpec === 'object' && 'kind' in typeSpec) {
    switch (typeSpec.kind) {
      case 'int': return 'int';
      case 'long': return 'long';
      case 'float': return 'float';
      case 'double': return 'double';
      case 'boolean': return 'boolean';
      case 'string': return 'String';
      case 'char': return 'char';
      case 'void': return 'void';
      case 'array':
        return `${typeSpecToJava(typeSpec.of)}[]`;
      case 'matrix':
        return `${typeSpecToJava(typeSpec.of)}[][]`;
      case 'linkedList': return 'ListNode';
      case 'tree': return 'TreeNode';
      default: return 'Object';
    }
  }

  // Fallback or error
  return 'Object';
}

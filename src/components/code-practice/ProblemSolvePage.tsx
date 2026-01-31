/**
 * ProblemSolvePage - Split-view problem solving interface
 */

import { useState, useCallback, useEffect, useRef } from 'react';
import { useParams, useNavigate } from 'react-router-dom';
import { useProblem, useDraft, useSaveDraft, useRunCode, useSubmitCode } from '../../hooks/useCodePractice';
import { CodeEditor } from './CodeEditor';
import { ResultsPanel } from './ResultsPanel';
import { ProblemDescription } from './ProblemDescription';
import { Button } from '../ui/button';
import { Badge } from '../ui/badge';
import { ArrowLeft, Play, Send, Loader2 } from 'lucide-react';
import type { ExecutionResult } from '../../hooks/useCodePractice';

type Language = 'java' | 'javascript' | 'typescript' | 'python';

const SUPPORTED_LANGUAGES: { value: Language; label: string; disabled: boolean }[] = [
  { value: 'java', label: 'Java', disabled: false },
  { value: 'javascript', label: 'JavaScript', disabled: true },
  { value: 'typescript', label: 'TypeScript', disabled: true },
  { value: 'python', label: 'Python', disabled: true },
];

export default function ProblemSolvePage() {
  const { problemId } = useParams<{ problemId: string }>();
  const navigate = useNavigate();
  
  const [language, setLanguage] = useState<Language>('java');
  const [code, setCode] = useState<string>('');
  const [result, setResult] = useState<ExecutionResult | null>(null);
  const [isInitialized, setIsInitialized] = useState(false);
  
  const { data: problem, isLoading: problemLoading } = useProblem(problemId);
  const { data: draftData, isLoading: draftLoading } = useDraft(problemId, language);
  const saveDraft = useSaveDraft();
  const runCode = useRunCode();
  const submitCode = useSubmitCode();
  
  // Debounce timer ref
  const saveTimerRef = useRef<NodeJS.Timeout | null>(null);

  // Generate starter code from function signature
  const generateStarterCode = useCallback(() => {
    if (!problem?.functionSignature) return '';
    
    const sig = problem.functionSignature;
    const params = sig.params.map(p => {
      // Convert TypeSpec to Java type
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

  // Initialize code from draft or starter
  useEffect(() => {
    if (problemLoading || draftLoading) return;
    
    if (!isInitialized) {
      if (draftData?.code) {
        setCode(draftData.code);
      } else {
        setCode(generateStarterCode());
      }
      setIsInitialized(true);
    }
  }, [problemLoading, draftLoading, draftData, generateStarterCode, isInitialized]);

  // Reset when language changes
  useEffect(() => {
    setIsInitialized(false);
    setResult(null);
  }, [language]);

  // Auto-save draft with debounce
  const handleCodeChange = useCallback((newCode: string) => {
    setCode(newCode);
    
    // Clear existing timer
    if (saveTimerRef.current) {
      clearTimeout(saveTimerRef.current);
    }
    
    // Set new timer for auto-save (1 second debounce)
    saveTimerRef.current = setTimeout(() => {
      if (problemId && newCode.trim()) {
        saveDraft.mutate({ problemId, language, code: newCode });
      }
    }, 1000);
  }, [problemId, language, saveDraft]);

  // Cleanup timer on unmount
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
    try {
      const res = await submitCode.mutateAsync({ problemId, code, language });
      setResult(res);
    } catch (error) {
      console.error('Submit error:', error);
    }
  }, [problemId, code, language, submitCode]);

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
    <div className="h-screen flex flex-col bg-background">
      {/* Header */}
      <div className="border-b border-border/40 bg-background/95 backdrop-blur px-4 py-2 flex items-center justify-between shrink-0">
        <div className="flex items-center gap-3">
          <Button variant="ghost" size="icon" onClick={() => navigate('/practice')}>
            <ArrowLeft className="h-5 w-5" />
          </Button>
          <h1 className="font-medium">{problem.title}</h1>
          <DifficultyBadge difficulty={problem.difficulty} />
        </div>
        
        <div className="flex items-center gap-2">
          {/* Language Selector */}
          <select
            value={language}
            onChange={(e) => setLanguage(e.target.value as Language)}
            className="h-9 px-3 rounded-md border border-input bg-background text-sm"
          >
            {SUPPORTED_LANGUAGES.map((lang) => (
              <option key={lang.value} value={lang.value} disabled={lang.disabled}>
                {lang.label} {lang.disabled && '(Coming Soon)'}
              </option>
            ))}
          </select>
          
          {/* Action Buttons */}
          <Button
            variant="outline"
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
          >
            {submitCode.isPending ? (
              <Loader2 className="h-4 w-4 mr-2 animate-spin" />
            ) : (
              <Send className="h-4 w-4 mr-2" />
            )}
            Submit
          </Button>
        </div>
      </div>

      {/* Split View */}
      <div className="flex-1 flex overflow-hidden">
        {/* Left Panel - Problem Description (40%) */}
        <div className="w-[40%] border-r border-border/40 overflow-y-auto">
          <ProblemDescription problem={problem} />
        </div>

        {/* Right Panel - Editor & Results (60%) */}
        <div className="w-[60%] flex flex-col">
          {/* Code Editor */}
          <div className="flex-1 min-h-0">
            <CodeEditor
              code={code}
              language={language}
              onChange={handleCodeChange}
              onRun={handleRun}
            />
          </div>
          
          {/* Results Panel */}
          {(result || isRunning) && (
            <div className="h-[40%] border-t border-border/40 overflow-y-auto">
              <ResultsPanel result={result} isLoading={isRunning} />
            </div>
          )}
        </div>
      </div>
    </div>
  );
}

// Helper component for difficulty badge
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

// Helper to convert TypeSpec to Java type string
function typeSpecToJava(typeSpec: unknown): string {
  // Handle string type specs (e.g., "int", "string")
  if (typeof typeSpec === 'string') {
    switch (typeSpec) {
      case 'int': return 'int';
      case 'long': return 'long';
      case 'float': return 'float';
      case 'double': return 'double';
      case 'boolean': return 'boolean';
      case 'string': return 'String';
      case 'char': return 'char';
      case 'void': return 'void';
      case 'linkedList': return 'ListNode';
      case 'tree': return 'TreeNode';
      default: return 'Object';
    }
  }
  
  // Handle object type specs
  if (typeSpec && typeof typeSpec === 'object' && 'type' in typeSpec) {
    const spec = typeSpec as { type: string; elementType?: unknown };
    switch (spec.type) {
      case 'int': return 'int';
      case 'long': return 'long';
      case 'float': return 'float';
      case 'double': return 'double';
      case 'boolean': return 'boolean';
      case 'string': return 'String';
      case 'char': return 'char';
      case 'void': return 'void';
      case 'array':
        if (spec.elementType) {
          return `${typeSpecToJava(spec.elementType)}[]`;
        }
        return 'Object[]';
      case 'matrix':
        if (spec.elementType) {
          return `${typeSpecToJava(spec.elementType)}[][]`;
        }
        return 'Object[][]';
      case 'linkedList': return 'ListNode';
      case 'tree': return 'TreeNode';
      default: return 'Object';
    }
  }
  
  return 'Object';
}

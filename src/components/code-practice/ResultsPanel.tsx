/**
 * ResultsPanel - Display test results and execution output
 */

import { CheckCircle2, XCircle, AlertCircle, Clock, Loader2 } from 'lucide-react';
import { Badge } from '../ui/badge';
import type { ExecutionResult } from '../../hooks/useCodePractice';

interface ResultsPanelProps {
  result: ExecutionResult | null;
  isLoading: boolean;
}

const verdictConfig: Record<string, { label: string; color: string; icon: typeof CheckCircle2 }> = {
  AC: { label: 'Accepted', color: 'text-green-500 bg-green-500/10', icon: CheckCircle2 },
  WA: { label: 'Wrong Answer', color: 'text-red-500 bg-red-500/10', icon: XCircle },
  TLE: { label: 'Time Limit Exceeded', color: 'text-yellow-500 bg-yellow-500/10', icon: Clock },
  MLE: { label: 'Memory Limit Exceeded', color: 'text-yellow-500 bg-yellow-500/10', icon: AlertCircle },
  RE: { label: 'Runtime Error', color: 'text-red-500 bg-red-500/10', icon: AlertCircle },
  CE: { label: 'Compilation Error', color: 'text-red-500 bg-red-500/10', icon: XCircle },
  PA: { label: 'Partially Accepted', color: 'text-yellow-500 bg-yellow-500/10', icon: AlertCircle },
};

export function ResultsPanel({ result, isLoading }: ResultsPanelProps) {
  if (isLoading) {
    return (
      <div className="p-4 flex items-center gap-3">
        <Loader2 className="h-5 w-5 animate-spin text-muted-foreground" />
        <span className="text-muted-foreground">Running tests...</span>
      </div>
    );
  }

  if (!result) {
    return null;
  }

  const config = verdictConfig[result.verdict] || verdictConfig.RE;
  const Icon = config.icon;

  return (
    <div className="p-4 space-y-4">
      {/* Overall Verdict */}
      <div className="flex items-center justify-between">
        <div className="flex items-center gap-3">
          <Icon className={`h-6 w-6 ${config.color.split(' ')[0]}`} />
          <div>
            <span className={`font-semibold ${config.color.split(' ')[0]}`}>
              {config.label}
            </span>
            {result.score !== undefined && result.score < 1 && result.score > 0 && (
              <span className="ml-2 text-muted-foreground">
                ({Math.round(result.score * 100)}% passed)
              </span>
            )}
          </div>
        </div>
        <div className="flex items-center gap-4 text-sm text-muted-foreground">
          <span>
            <Clock className="h-4 w-4 inline mr-1" />
            {result.totalTimeMs}ms
          </span>
          <span>
            {result.testResults.filter(t => t.passed).length}/{result.testResults.length} tests passed
          </span>
        </div>
      </div>

      {/* Compilation Error */}
      {result.compilationError && (
        <div className="rounded-md bg-red-500/10 border border-red-500/20 p-3">
          <p className="text-sm font-medium text-red-500 mb-2">Compilation Error</p>
          <pre className="text-xs text-red-400 whitespace-pre-wrap font-mono overflow-x-auto">
            {result.compilationError}
          </pre>
        </div>
      )}

      {/* Runtime Error */}
      {result.runtimeError && (
        <div className="rounded-md bg-red-500/10 border border-red-500/20 p-3">
          <p className="text-sm font-medium text-red-500 mb-2">Runtime Error</p>
          <pre className="text-xs text-red-400 whitespace-pre-wrap font-mono overflow-x-auto">
            {result.runtimeError}
          </pre>
        </div>
      )}

      {/* Test Results */}
      {result.testResults.length > 0 && !result.compilationError && (
        <div className="space-y-2">
          <p className="text-sm font-medium">Test Cases</p>
          <div className="space-y-2">
            {result.testResults.map((test, index) => (
              <TestResultCard key={test.testId} test={test} index={index} />
            ))}
          </div>
        </div>
      )}
    </div>
  );
}

interface TestResultCardProps {
  test: ExecutionResult['testResults'][number];
  index: number;
}

function TestResultCard({ test, index }: TestResultCardProps) {
  const isHidden = !test.expectedOutput && !test.actualOutput;
  
  return (
    <div className={`rounded-md border p-3 ${test.passed ? 'border-green-500/20 bg-green-500/5' : 'border-red-500/20 bg-red-500/5'}`}>
      <div className="flex items-center justify-between mb-2">
        <div className="flex items-center gap-2">
          {test.passed ? (
            <CheckCircle2 className="h-4 w-4 text-green-500" />
          ) : (
            <XCircle className="h-4 w-4 text-red-500" />
          )}
          <span className="text-sm font-medium">
            Test Case {index + 1}
            {isHidden && <span className="text-muted-foreground ml-2">(Hidden)</span>}
          </span>
        </div>
        <div className="flex items-center gap-2">
          {test.timeMs !== undefined && (
            <Badge variant="outline" className="text-xs">
              {test.timeMs}ms
            </Badge>
          )}
          <Badge 
            variant="outline" 
            className={`text-xs ${test.passed ? 'text-green-500 border-green-500/30' : 'text-red-500 border-red-500/30'}`}
          >
            {test.verdict}
          </Badge>
        </div>
      </div>

      {/* Only show details for visible tests */}
      {!isHidden && (
        <div className="space-y-2 text-xs font-mono">
          {test.expectedOutput !== undefined && (
            <div>
              <span className="text-muted-foreground">Expected: </span>
              <span className="text-foreground">
                {formatOutput(test.expectedOutput)}
              </span>
            </div>
          )}
          {test.actualOutput !== undefined && (
            <div>
              <span className="text-muted-foreground">Output: </span>
              <span className={test.passed ? 'text-green-500' : 'text-red-500'}>
                {formatOutput(test.actualOutput)}
              </span>
            </div>
          )}
          {test.stdout && (
            <div>
              <span className="text-muted-foreground">Stdout: </span>
              <pre className="text-foreground whitespace-pre-wrap inline">
                {test.stdout}
              </pre>
            </div>
          )}
          {test.stderr && (
            <div>
              <span className="text-muted-foreground">Stderr: </span>
              <pre className="text-red-400 whitespace-pre-wrap inline">
                {test.stderr}
              </pre>
            </div>
          )}
        </div>
      )}
    </div>
  );
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

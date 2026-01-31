/**
 * ResultsPanel - Display test results and execution output
 */

import { CheckCircle2, XCircle, AlertCircle, Clock, Loader2 } from 'lucide-react';
import { Badge } from '../ui/badge';
import type { ExecutionResult } from '../../hooks/useCodePractice';

interface ResultsPanelProps {
  result: ExecutionResult | null;
  isLoading: boolean;
  onRetry?: () => void;
  onNext?: () => void;
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

export function ResultsPanel({ result, isLoading, onRetry, onNext }: ResultsPanelProps) {
  if (isLoading) {
    return (
      <div className="h-full flex flex-col items-center justify-center gap-3 p-8">
        <Loader2 className="h-8 w-8 animate-spin text-primary" />
        <span className="text-muted-foreground font-medium">Running tests...</span>
      </div>
    );
  }

  if (!result) {
    return (
      <div className="h-full flex flex-col items-center justify-center p-8 text-center text-muted-foreground">
        <div className="bg-muted/30 p-4 rounded-full mb-3">
          <Clock className="h-6 w-6 opacity-50" />
        </div>
        <p className="font-medium">Ready to run</p>
        <p className="text-sm">Run your code to see results here</p>
      </div>
    );
  }

  const config = verdictConfig[result.verdict] || verdictConfig.RE;
  const Icon = config.icon;
  const isSuccess = result.verdict === 'AC';

  return (
    <div className="p-4 space-y-6">
      {/* Overall Verdict Banner */}
      <div className={`rounded-xl border p-6 flex flex-col items-center text-center gap-4 ${result.verdict === 'AC' ? 'bg-green-500/5 border-green-500/20' : 'bg-red-500/5 border-red-500/20'}`}>
        <div className={`p-3 rounded-full ${result.verdict === 'AC' ? 'bg-green-100 dark:bg-green-900/30 text-green-600' : 'bg-red-100 dark:bg-red-900/30 text-red-600'}`}>
          <Icon className="h-8 w-8" />
        </div>
        <div>
          <h2 className="text-2xl font-bold mb-1">{config.label}</h2>
          <div className="flex items-center justify-center gap-4 text-sm text-muted-foreground">
            <span className="flex items-center gap-1">
              <Clock className="h-3 w-3" /> {result.totalTimeMs}ms
            </span>
            <span>•</span>
            <span>
              {result.testResults.filter(t => t.passed).length}/{result.testResults.length} tests passed
            </span>
          </div>
        </div>

        {/* Actions */}
        <div className="flex gap-3 mt-2 w-full max-w-xs">
          {onRetry && !isSuccess && (
            <button
              onClick={onRetry}
              className="flex-1 bg-secondary hover:bg-secondary/80 text-secondary-foreground h-9 rounded-md text-sm font-medium transition-colors"
            >
              Retry
            </button>
          )}
          {onNext && isSuccess && (
            <button
              onClick={onNext}
              className="flex-1 bg-primary hover:bg-primary/90 text-primary-foreground h-9 rounded-md text-sm font-medium transition-colors flex items-center justify-center gap-2"
            >
              Next Problem
              <svg width="15" height="15" viewBox="0 0 15 15" fill="none" xmlns="http://www.w3.org/2000/svg" className="h-4 w-4"><path d="M6.1584 3.13508C6.35985 2.94621 6.67627 2.95642 6.86514 3.15788L10.6151 7.15788C10.7954 7.3502 10.7954 7.64949 10.6151 7.84182L6.86514 11.8418C6.67627 12.0433 6.35985 12.0535 6.1584 11.8646C5.95694 11.6757 5.94673 11.3593 6.1356 11.1579L9.56039 7.49985L6.1356 3.84182C5.94673 3.64036 5.95694 3.32394 6.1584 3.13508Z" fill="currentColor" fillRule="evenodd" clipRule="evenodd"></path></svg>
            </button>
          )}
        </div>
      </div>

      {/* Compilation Error */}
      {result.compilationError && (
        <div className="rounded-lg bg-destructive/10 border border-destructive/20 p-4">
          <p className="text-sm font-semibold text-destructive mb-2 flex items-center gap-2">
            <AlertCircle className="h-4 w-4" /> Compilation Error
          </p>
          <pre className="text-xs text-destructive whitespace-pre-wrap font-mono overflow-x-auto bg-background/50 p-3 rounded border">
            {result.compilationError}
          </pre>
        </div>
      )}

      {/* Runtime Error */}
      {result.runtimeError && (
        <div className="rounded-lg bg-destructive/10 border border-destructive/20 p-4">
          <p className="text-sm font-semibold text-destructive mb-2 flex items-center gap-2">
            <AlertCircle className="h-4 w-4" /> Runtime Error
          </p>
          <pre className="text-xs text-destructive whitespace-pre-wrap font-mono overflow-x-auto bg-background/50 p-3 rounded border">
            {result.runtimeError}
          </pre>
        </div>
      )}

      {/* Test Results */}
      {result.testResults.length > 0 && !result.compilationError && (
        <div className="space-y-3">
          <h3 className="font-medium">Test Case Details</h3>
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

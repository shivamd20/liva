import { useEffect } from 'react';
import { useQuery } from '@tanstack/react-query';
import { trpcClient } from '@/trpcClient';
import { Loader2, CheckCircle, AlertCircle } from 'lucide-react';
import { Button } from '@/components/ui/button';
import { cn } from '@/lib/utils';

export type ProcessingStatus =
  | 'queued'
  | 'uploading_chunks'
  | 'processing'
  | 'downloading_results'
  | 'transcribing'
  | 'generating_tts'
  | 'complete'
  | 'failed';

const STEPS: { key: ProcessingStatus; label: string }[] = [
  { key: 'queued', label: 'Preparing to process...' },
  { key: 'uploading_chunks', label: 'Uploading video data...' },
  { key: 'processing', label: 'Processing video with AI...' },
  { key: 'downloading_results', label: 'Saving processed video...' },
  { key: 'transcribing', label: 'Generating transcript...' },
  { key: 'generating_tts', label: 'Creating AI narration...' },
  { key: 'complete', label: 'Processing complete!' },
];

export interface ProcessingProgressProps {
  videoId: string;
  onComplete?: () => void;
}

export function ProcessingProgress({ videoId, onComplete }: ProcessingProgressProps) {
  const { data, isError, error } = useQuery({
    queryKey: ['processing-status', videoId],
    queryFn: () => trpcClient.processing.getStatusByVideoId.query({ videoId }),
    refetchInterval: (query) => {
      const status = query.state.data?.status;
      return status === 'complete' || status === 'failed' ? false : 2000;
    },
    refetchIntervalInBackground: true,
  });

  const status = (data?.status ?? 'queued') as ProcessingStatus;
  const progress = data?.progress ?? 0;
  const errorMessage = data?.error ?? (error as Error)?.message;

  // Stop polling and call onComplete when complete
  useEffect(() => {
    if (status === 'complete' && onComplete) {
      onComplete();
    }
  }, [status, onComplete]);

  const currentStepIndex = STEPS.findIndex((s) => s.key === status);
  const isComplete = status === 'complete';
  const isFailed = status === 'failed';

  return (
    <div
      className={cn(
        'rounded-xl border border-border bg-card p-6 shadow-sm',
        'dark:border-zinc-800 dark:bg-zinc-900/50'
      )}
    >
      {/* Step indicator */}
      <div className="mb-6 flex items-center justify-between gap-2">
        {STEPS.slice(0, -1).map((step, i) => {
          const isActive = i === currentStepIndex && !isComplete && !isFailed;
          const isDone = i < currentStepIndex || isComplete;
          const isFailedStep = isFailed && i === currentStepIndex;

          return (
            <div key={step.key} className="flex flex-1 items-center">
              <div
                className={cn(
                  'flex h-8 w-8 shrink-0 items-center justify-center rounded-full border-2 transition-colors',
                  isDone && 'border-emerald-500 bg-emerald-500/20 text-emerald-600 dark:text-emerald-400',
                  isActive && 'border-primary bg-primary/10 text-primary',
                  isFailedStep && 'border-red-500 bg-red-500/20 text-red-600 dark:text-red-400',
                  !isDone && !isActive && !isFailedStep && 'border-muted-foreground/30 text-muted-foreground'
                )}
              >
                {isDone ? (
                  <CheckCircle className="h-4 w-4" />
                ) : isFailedStep ? (
                  <AlertCircle className="h-4 w-4" />
                ) : isActive ? (
                  <Loader2 className="h-4 w-4 animate-spin" />
                ) : (
                  <span className="text-xs font-medium">{i + 1}</span>
                )}
              </div>
              {i < STEPS.length - 2 && (
                <div
                  className={cn(
                    'mx-1 h-0.5 flex-1 rounded-full transition-colors',
                    i < currentStepIndex || isComplete ? 'bg-emerald-500/50' : 'bg-muted/50'
                  )}
                />
              )}
            </div>
          );
        })}
      </div>

      {/* Status message and progress */}
      {isFailed ? (
        <div className="space-y-4">
          <div className="flex items-center gap-3 rounded-lg border border-red-200 bg-red-50 p-4 dark:border-red-900/50 dark:bg-red-950/30">
            <AlertCircle className="h-6 w-6 shrink-0 text-red-600 dark:text-red-400" />
            <div>
              <p className="font-medium text-red-800 dark:text-red-200">Processing failed</p>
              <p className="mt-1 text-sm text-red-700 dark:text-red-300">
                {errorMessage || 'An unexpected error occurred.'}
              </p>
            </div>
          </div>
          <Button variant="outline" size="sm" disabled className="gap-2">
            Retry
          </Button>
        </div>
      ) : isComplete ? (
        <div className="flex items-center gap-3 rounded-lg border border-emerald-200 bg-emerald-50 p-4 dark:border-emerald-900/50 dark:bg-emerald-950/30">
          <CheckCircle className="h-6 w-6 shrink-0 text-emerald-600 dark:text-emerald-400" />
          <p className="font-medium text-emerald-800 dark:text-emerald-200">Processing complete!</p>
        </div>
      ) : (
        <>
          <p className="mb-4 text-sm font-medium text-foreground">
            {STEPS.find((s) => s.key === status)?.label ?? 'Processing...'}
          </p>
          <div className="h-2 overflow-hidden rounded-full bg-muted">
            <div
              className="h-full rounded-full bg-primary transition-all duration-500 ease-out"
              style={{ width: `${Math.min(100, Math.max(0, progress))}%` }}
            />
          </div>
          {(status === 'uploading_chunks' ||
            status === 'processing' ||
            status === 'downloading_results' ||
            status === 'transcribing' ||
            status === 'generating_tts') && (
            <p className="mt-2 text-xs text-muted-foreground">{Math.round(progress)}%</p>
          )}
        </>
      )}
    </div>
  );
}

export default ProcessingProgress;

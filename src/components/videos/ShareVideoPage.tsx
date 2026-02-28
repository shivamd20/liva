import { useEffect } from 'react';
import { useParams } from 'react-router-dom';
import { useQuery } from '@tanstack/react-query';
import { MonorailPlayer } from '@/components/MonorailPlayer';
import { Button } from '@/components/ui/button';
import { Loader2, Download, Calendar, Clock, AlertCircle } from 'lucide-react';

interface ShareInfo {
  sessionId: string;
  title: string;
  description?: string;
  createdAt: string;
}

async function fetchShareInfo(videoId: string): Promise<ShareInfo | null> {
  const res = await fetch(`/api/share/${videoId}`);
  if (!res.ok) {
    if (res.status === 404) return null;
    throw new Error('Failed to load video');
  }
  const data = (await res.json()) as { sessionId?: string; title?: string; description?: string; createdAt?: string };
  if (!data.sessionId) return null;
  return {
    sessionId: data.sessionId,
    title: data.title ?? 'Untitled Video',
    description: data.description,
    createdAt: data.createdAt ?? new Date().toISOString(),
  };
}

function ShareVideoPage() {
  const { videoId } = useParams<{ videoId: string }>();

  const { data: shareInfo, isLoading, isError, error } = useQuery({
    queryKey: ['share', videoId],
    queryFn: () => fetchShareInfo(videoId!),
    enabled: !!videoId,
  });

  if (!videoId) {
    return (
      <div className="min-h-screen bg-white dark:bg-zinc-950 flex items-center justify-center">
        <p className="text-muted-foreground">Invalid share link</p>
      </div>
    );
  }

  if (isLoading) {
    return (
      <div className="min-h-screen bg-white dark:bg-zinc-950 flex items-center justify-center">
        <Loader2 className="w-10 h-10 animate-spin text-zinc-400" />
      </div>
    );
  }

  if (isError || !shareInfo) {
    return (
      <div className="min-h-screen bg-white dark:bg-zinc-950 flex flex-col items-center justify-center gap-6 p-8">
        <div className="flex flex-col items-center gap-3 text-center max-w-md">
          <AlertCircle className="w-12 h-12 text-zinc-400 dark:text-zinc-500" />
          <h1 className="text-xl font-semibold text-zinc-900 dark:text-zinc-100">
            Video not found
          </h1>
          <p className="text-sm text-muted-foreground">
            {isError ? (error as Error)?.message : 'This video may have been removed or the link is invalid.'}
          </p>
        </div>
      </div>
    );
  }

  const formattedDate = new Date(shareInfo.createdAt).toLocaleDateString(undefined, {
    year: 'numeric',
    month: 'long',
    day: 'numeric',
  });

  const downloadUrl = `/api/processed/${shareInfo.sessionId}/video.mp4`;

  // OG meta tags: set document title; for full OG support use react-helmet-async or similar
  useEffect(() => {
    document.title = `${shareInfo.title} | Liva`;
    return () => {
      document.title = 'Liva';
    };
  }, [shareInfo.title]);

  return (
    <div className="min-h-screen bg-white dark:bg-zinc-950">
        <div className="max-w-4xl mx-auto w-full px-4 py-8 md:py-12">
          {/* Video player */}
          <div className="w-full aspect-video rounded-xl overflow-hidden bg-black shadow-lg mb-6">
            <MonorailPlayer sessionId={shareInfo.sessionId} autoPlay={false} />
          </div>

          {/* Metadata card */}
          <div className="rounded-xl border border-zinc-200 dark:border-zinc-800 bg-white dark:bg-zinc-900/50 p-6 shadow-sm">
            <h1 className="text-2xl md:text-3xl font-bold text-zinc-900 dark:text-zinc-100 mb-2">
              {shareInfo.title}
            </h1>
            {shareInfo.description && (
              <p className="text-zinc-600 dark:text-zinc-400 mb-4 leading-relaxed">
                {shareInfo.description}
              </p>
            )}
            <div className="flex flex-wrap items-center gap-4 text-sm text-muted-foreground mb-6">
              <span className="flex items-center gap-1.5">
                <Calendar className="w-4 h-4" />
                {formattedDate}
              </span>
              <span className="flex items-center gap-1.5">
                <Clock className="w-4 h-4" />
                {new Date(shareInfo.createdAt).toLocaleTimeString(undefined, {
                  hour: '2-digit',
                  minute: '2-digit',
                })}
              </span>
            </div>

            {/* Download button */}
            <a href={downloadUrl} download="video.mp4">
              <Button
                variant="default"
                size="lg"
                className="gap-2 w-full sm:w-auto"
              >
                <Download className="w-5 h-5" />
                Download video
              </Button>
            </a>
          </div>

          {/* Footer branding */}
          <footer className="mt-12 pt-8 border-t border-zinc-200 dark:border-zinc-800 text-center">
            <p className="text-sm text-muted-foreground">
              Made with{' '}
              <a
                href="/"
                className="font-medium text-zinc-900 dark:text-zinc-100 hover:underline"
              >
                Liva
              </a>
            </p>
          </footer>
        </div>
      </div>
  );
}

export default ShareVideoPage;

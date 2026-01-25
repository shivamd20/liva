import { useNavigate, useParams, Link } from 'react-router-dom';
import { trpcClient } from '../../trpcClient';
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import { Button } from '@/components/ui/button';
import { ArrowLeft, Youtube, Loader2, ExternalLink, CheckCircle, AlertCircle, Layout } from 'lucide-react';
import { MonorailPlayer } from '@/components/MonorailPlayer';
import { useEffect, useState } from 'react';
import { Input } from '@/components/ui/input';
import { Textarea } from '@/components/ui/textarea';
import { toast } from 'sonner';

export function VideoDetailPage() {
    const { videoId } = useParams<{ videoId: string }>();
    const navigate = useNavigate();
    const queryClient = useQueryClient();

    // YouTube publish state
    const [publishId, setPublishId] = useState<string | null>(null);
    const [publishStatus, setPublishStatus] = useState<'INIT' | 'UPLOADING_TO_YT' | 'DONE' | 'FAILED' | null>(null);
    const [uploadProgress, setUploadProgress] = useState(0);

    // Fetch Video
    const { data: video, isLoading, refetch } = useQuery({
        queryKey: ['video', videoId],
        queryFn: () => trpcClient.videos.get.query({ id: videoId! }),
        enabled: !!videoId
    });

    // Check YouTube integration status
    const { data: ytStatus } = useQuery({
        queryKey: ['youtube-status'],
        queryFn: async () => {
            try {
                const res = await fetch('/api/integrations/youtube');
                if (!res.ok) return { connected: false };
                return (await res.json()) as { connected: boolean };
            } catch (e) {
                return { connected: false };
            }
        },
        staleTime: 60000
    });

    // Update Metadata Mutation
    const updateMetadataMutation = useMutation({
        mutationFn: (data: { id: string; title: string; description?: string }) =>
            trpcClient.videos.updateMetadata.mutate(data),
        onSuccess: () => {
            toast.success("Changes saved");
            refetch();
        },
        onError: () => {
            toast.error("Failed to save changes");
        }
    });

    // Polling for upload progress
    useQuery({
        queryKey: ['publish-progress', publishId],
        queryFn: async () => {
            if (!publishId) return null;
            const progress = await trpcClient.monorail.getPublishProgress.query({ publishId });

            setPublishStatus(progress.status as any);
            if (progress.youtube?.bytesUploaded && progress.totalBytes) {
                setUploadProgress(progress.youtube.bytesUploaded / progress.totalBytes);
            }

            if (progress.status === 'DONE' && progress.youtube?.videoId) {
                setPublishId(null);
                toast.success("Video uploaded to YouTube!");
                queryClient.invalidateQueries({ queryKey: ['video', videoId] });
                refetch();
            } else if (progress.status === 'FAILED') {
                setPublishId(null);
                toast.error("YouTube upload failed: " + progress.error);
            }

            return progress;
        },
        enabled: !!publishId,
        refetchInterval: 1000
    });

    // Local State for editing
    const [title, setTitle] = useState('');
    const [description, setDescription] = useState('');

    // Sync state with data when loaded
    useEffect(() => {
        if (video) {
            setTitle(video.title || "Untitled Video");
            setDescription(video.description || "");
        }
    }, [video]);

    const handleSave = async () => {
        if (!video) return;
        updateMetadataMutation.mutate({
            id: video.id,
            title,
            description
        });
    };

    const handleExportToYouTube = async () => {
        if (!video) return;

        try {
            setPublishStatus('INIT');
            const init = await trpcClient.monorail.initPublish.mutate({
                monorailSessionId: video.sessionId,
                videoId: video.id
            });
            setPublishId(init.publishId);
            await trpcClient.monorail.startPublish.mutate({ publishId: init.publishId });
            toast.info("Upload started...");
        } catch (error: any) {
            console.error('[YouTube Export] Failed:', error);
            setPublishStatus('FAILED');
            toast.error("Failed to start upload: " + (error.message || "Unknown error"));
        }
    };

    if (isLoading) {
        return (
            <div className="flex items-center justify-center h-full bg-white dark:bg-zinc-950">
                <Loader2 className="w-8 h-8 animate-spin text-zinc-400" />
            </div>
        );
    }

    if (!video) {
        return (
            <div className="flex flex-col items-center justify-center h-full gap-4">
                <p className="text-zinc-500">Video not found</p>
                <Button variant="outline" onClick={() => navigate('/app/videos')}>
                    Back to Videos
                </Button>
            </div>
        );
    }

    const hasChanges = video.title !== title || (video.description || "") !== description;
    const isUploading = publishStatus === 'INIT' || publishStatus === 'UPLOADING_TO_YT';
    const canExport = video.status === 'RECORDED' && ytStatus?.connected && !isUploading && !video.youtubeId;

    return (
        <div className="flex flex-col h-full bg-white dark:bg-zinc-950">
            {/* Header */}
            <header className="flex items-center justify-between px-4 py-3 border-b border-zinc-100 dark:border-zinc-800 bg-white dark:bg-zinc-950 sticky top-0 z-20 shadow-sm">
                <div className="flex items-center gap-3">
                    <Button
                        variant="ghost"
                        size="icon"
                        className="-ml-2 text-zinc-500 hover:text-zinc-900 dark:hover:text-zinc-100"
                        onClick={() => navigate('/app/videos')}
                    >
                        <ArrowLeft className="w-5 h-5" />
                    </Button>
                    <h1 className="text-sm font-semibold text-zinc-900 dark:text-zinc-100 truncate max-w-[200px] md:max-w-md">
                        {video.title || "Untitled Recording"}
                    </h1>
                </div>
                <div className="flex items-center gap-2">
                    <Button
                        variant={hasChanges ? "default" : "ghost"}
                        size="sm"
                        onClick={handleSave}
                        disabled={updateMetadataMutation.isPending || !hasChanges}
                        className="transition-all"
                    >
                        {updateMetadataMutation.isPending ? <Loader2 className="w-4 h-4 animate-spin" /> : "Save"}
                    </Button>
                </div>
            </header>

            <main className="flex-1 overflow-y-auto">
                <div className="max-w-5xl mx-auto w-full pb-20">
                    {/* Video Player Container */}
                    <div className="w-full bg-black aspect-video relative shadow-lg z-10">
                        <MonorailPlayer sessionId={video.sessionId} autoPlay={false} />
                    </div>

                    {/* Content */}
                    <div className="p-4 md:p-8 space-y-8 max-w-3xl mx-auto">

                        {/* Status & Actions Bar */}
                        <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4 pb-4 border-b border-zinc-100 dark:border-zinc-800">
                            <div className="flex items-center gap-3 flex-wrap">
                                <div className={`px-3 py-1 rounded-full text-xs font-semibold border
                                    ${video.status === 'PUBLISHED' ? 'bg-green-50 text-green-700 border-green-200' :
                                        video.status === 'PROCESSING' ? 'bg-blue-50 text-blue-700 border-blue-200' :
                                            'bg-zinc-100 text-zinc-700 border-zinc-200'}`}
                                >
                                    {video.status}
                                </div>
                                <span className="text-xs text-zinc-400">
                                    {new Date(video.createdAt || Date.now()).toLocaleDateString()}
                                </span>
                                {video.boardId && (
                                    <Link
                                        to={`/board/${video.boardId}`}
                                        className="flex items-center gap-1 text-xs text-blue-600 hover:text-blue-700"
                                    >
                                        <Layout className="w-3 h-3" />
                                        View Board
                                    </Link>
                                )}
                            </div>

                            <div className="flex items-center gap-2">
                                {/* YouTube Link if uploaded */}
                                {video.videoUrl && (
                                    <a
                                        href={video.videoUrl}
                                        target="_blank"
                                        rel="noopener noreferrer"
                                        className="flex items-center gap-2 px-3 py-1.5 text-sm font-medium text-red-600 bg-red-50 hover:bg-red-100 border border-red-200 rounded-lg transition-colors"
                                    >
                                        <Youtube className="w-4 h-4" />
                                        Watch on YouTube
                                        <ExternalLink className="w-3 h-3" />
                                    </a>
                                )}

                                {/* Upload Progress */}
                                {isUploading && (
                                    <div className="flex items-center gap-2 px-3 py-1.5 bg-blue-50 border border-blue-200 rounded-lg">
                                        <Loader2 className="w-4 h-4 animate-spin text-blue-600" />
                                        <span className="text-sm font-medium text-blue-700">
                                            {publishStatus === 'INIT' ? 'Preparing...' : `Uploading ${Math.round(uploadProgress * 100)}%`}
                                        </span>
                                    </div>
                                )}

                                {/* Upload Success */}
                                {publishStatus === 'DONE' && (
                                    <div className="flex items-center gap-2 px-3 py-1.5 bg-green-50 border border-green-200 rounded-lg">
                                        <CheckCircle className="w-4 h-4 text-green-600" />
                                        <span className="text-sm font-medium text-green-700">Uploaded!</span>
                                    </div>
                                )}

                                {/* Upload Failed */}
                                {publishStatus === 'FAILED' && (
                                    <div className="flex items-center gap-2 px-3 py-1.5 bg-red-50 border border-red-200 rounded-lg">
                                        <AlertCircle className="w-4 h-4 text-red-600" />
                                        <span className="text-sm font-medium text-red-700">Upload failed</span>
                                    </div>
                                )}

                                {/* Export Button */}
                                {!video.videoUrl && !isUploading && (
                                    <Button
                                        variant="outline"
                                        size="sm"
                                        className={`gap-2 w-full sm:w-auto transition-colors ${canExport
                                            ? 'hover:bg-red-50 hover:text-red-600 hover:border-red-200'
                                            : 'opacity-50'
                                            }`}
                                        disabled={!canExport}
                                        onClick={handleExportToYouTube}
                                        title={
                                            !ytStatus?.connected
                                                ? "Connect YouTube in Settings first"
                                                : video.status !== 'RECORDED'
                                                    ? "Wait for recording to be processed"
                                                    : "Export to YouTube"
                                        }
                                    >
                                        <Youtube className="w-4 h-4" />
                                        Export to YouTube
                                    </Button>
                                )}

                                {/* Connect YouTube prompt */}
                                {!ytStatus?.connected && !video.videoUrl && (
                                    <Button
                                        variant="ghost"
                                        size="sm"
                                        className="text-xs text-zinc-500"
                                        onClick={() => navigate('/app/integrations')}
                                    >
                                        Connect YouTube →
                                    </Button>
                                )}
                            </div>
                        </div>

                        {/* Metadata Editing */}
                        <div className="space-y-6">
                            <div className="space-y-2">
                                <Input
                                    value={title}
                                    onChange={(e) => setTitle(e.target.value)}
                                    className="text-2xl md:text-3xl font-bold border-transparent px-0 hover:border-zinc-200 focus:border-zinc-300 focus:px-3 focus:ring-4 focus:ring-zinc-100 transition-all rounded-lg h-auto py-2 bg-transparent placeholder:text-zinc-300"
                                    placeholder="Untitled Video"
                                />
                            </div>

                            <div className="space-y-2">
                                <Textarea
                                    value={description}
                                    onChange={(e) => setDescription(e.target.value)}
                                    className="min-h-[200px] text-base leading-relaxed resize-y border-transparent hover:border-zinc-200 focus:border-zinc-300 bg-zinc-50/50 dark:bg-zinc-900/50 p-4 rounded-xl focus:ring-4 focus:ring-zinc-100 transition-all placeholder:text-zinc-400"
                                    placeholder="Add a description to your video..."
                                />
                            </div>
                        </div>
                    </div>
                </div>
            </main>
        </div>
    );
}

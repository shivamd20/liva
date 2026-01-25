import { useNavigate, useParams } from 'react-router-dom';
import { trpcClient } from '../../trpcClient';
import { useQuery, useMutation } from '@tanstack/react-query';
import { Button } from '@/components/ui/button';
import { ArrowLeft, Youtube, Loader2 } from 'lucide-react';
import { MonorailPlayer } from '@/components/MonorailPlayer';
import { useEffect, useState } from 'react';
import { Input } from '@/components/ui/input';
import { Textarea } from '@/components/ui/textarea';
import { toast } from 'sonner';

export function VideoDetailPage() {
    const { videoId } = useParams<{ videoId: string }>();
    const navigate = useNavigate();

    // Fetch Video
    const { data: video, isLoading, refetch } = useQuery({
        queryKey: ['video', videoId],
        queryFn: () => trpcClient.videos.get.query({ id: videoId! }),
        enabled: !!videoId
    });

    // Update Metadata Mutation
    const updateMetadataCurrent = useMutation({
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
        updateMetadataCurrent.mutate({
            id: video.id,
            title,
            description
        });
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
                        disabled={updateMetadataCurrent.isPending || !hasChanges}
                        className="transition-all"
                    >
                        {updateMetadataCurrent.isPending ? <Loader2 className="w-4 h-4 animate-spin" /> : "Save"}
                    </Button>
                </div>
            </header>

            <main className="flex-1 overflow-y-auto">
                <div className="max-w-5xl mx-auto w-full pb-20">
                    {/* Video Player Container - Not Full Screen, but Prominent */}
                    <div className="w-full bg-black aspect-video relative shadow-lg z-10">
                        <MonorailPlayer sessionId={video.sessionId} autoPlay={false} />
                    </div>

                    {/* Content */}
                    <div className="p-4 md:p-8 space-y-8 max-w-3xl mx-auto">

                        {/* Status & Actions Bar */}
                        <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4 pb-4 border-b border-zinc-100 dark:border-zinc-800">
                            <div className="flex items-center gap-3">
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
                            </div>

                            <Button
                                variant="outline"
                                size="sm"
                                className="gap-2 w-full sm:w-auto hover:bg-red-50 hover:text-red-600 hover:border-red-200 transition-colors"
                                disabled={video.status !== 'RECORDED'}
                            >
                                <Youtube className="w-4 h-4" />
                                Export to YouTube
                            </Button>
                        </div>

                        {/* Metadata Editing - Clean Layout */}
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

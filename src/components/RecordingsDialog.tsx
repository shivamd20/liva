import { useState } from 'react';
import {
    Dialog,
    DialogContent,
    DialogHeader,
    DialogTitle,
    DialogDescription
} from "@/components/ui/dialog";
import { Button } from "@/components/ui/button";
import { ScrollArea } from "@/components/ui/scroll-area";
import { Play, Calendar, Clock, Film, ExternalLink } from "lucide-react";
import { trpcClient } from '../trpcClient';
import { useQuery, useMutation } from '@tanstack/react-query';
import { MonorailPlayer } from './MonorailPlayer';
import { cn } from "@/lib/utils";

interface RecordingsDialogProps {
    open: boolean;
    onOpenChange: (open: boolean) => void;
    boardId: string;
}

export function RecordingsDialog({ open, onOpenChange, boardId }: RecordingsDialogProps) {
    const [selectedSessionId, setSelectedSessionId] = useState<string | null>(null);

    const { data: recordings, isLoading } = useQuery({
        queryKey: ['recordings', boardId],
        queryFn: () => trpcClient.getRecordings.query({ id: boardId }),
        enabled: open,
    });

    const formatDuration = (seconds: number) => {
        const m = Math.floor(seconds / 60);
        const s = Math.floor(seconds % 60);
        return `${m}:${s.toString().padStart(2, '0')}`;
    };

    const [publishId, setPublishId] = useState<string | null>(null);
    const [isPublishing, setIsPublishing] = useState(false);

    // Check YouTube connection
    const { data: youtubeStatus } = useQuery({
        queryKey: ['youtube-integrations'],
        queryFn: async () => {
            const res = await fetch('/api/integrations/youtube');
            if (res.status === 404) return { connected: false };
            if (!res.ok) throw new Error("Failed to check status");
            return await res.json() as { connected: boolean, channels: any[] };
        },
        enabled: open,
    });

    // Mutations
    const { mutateAsync: initPublish } = useMutation({
        mutationFn: (sessionId: string) => trpcClient.monorail.initPublish.mutate({ monorailSessionId: sessionId })
    });

    const { mutateAsync: startPublish } = useMutation({
        mutationFn: (pId: string) => trpcClient.monorail.startPublish.mutate({ publishId: pId })
    });

    // Poll progress
    const { data: publishProgress } = useQuery({
        queryKey: ['publish-progress', publishId],
        queryFn: () => trpcClient.monorail.getPublishProgress.query({ publishId: publishId! }),
        enabled: !!publishId,
        refetchInterval: (query) => {
            const status = query.state.data?.status;
            return (status === 'DONE' || status === 'FAILED') ? false : 1000;
        },
    });

    const handlePublish = async (sessionId: string) => {
        try {
            setIsPublishing(true);
            const init = await initPublish(sessionId);
            setPublishId(init.publishId);
            await startPublish(init.publishId);
        } catch (e) {
            console.error("Publish failed", e);
            setIsPublishing(false);
        }
    };

    return (
        <Dialog open={open} onOpenChange={onOpenChange}>
            <DialogContent className="w-[90vw] h-[85vh] sm:max-w-[90vw] p-0 gap-0 overflow-hidden flex flex-col bg-background text-foreground border-border shadow-lg sm:rounded-xl">
                <DialogHeader className="p-6 border-b border-border flex-shrink-0 flex flex-row items-center justify-between">
                    <div>
                        <DialogTitle className="text-xl font-semibold tracking-tight">Board Recordings</DialogTitle>
                        <DialogDescription className="text-muted-foreground">
                            Review and play back recorded sessions from this board.
                        </DialogDescription>
                    </div>
                </DialogHeader>

                <div className="flex flex-1 overflow-hidden h-full">
                    {/* Sidebar List */}
                    <div className="w-1/3 border-r border-border bg-muted/30 flex flex-col">
                        <ScrollArea className="flex-1 w-full">
                            <div className="p-3 flex flex-col gap-2">
                                {isLoading ? (
                                    <div className="flex flex-col items-center justify-center py-10 gap-2 text-muted-foreground">
                                        <div className="w-4 h-4 rounded-full border-2 border-primary border-t-transparent animate-spin" />
                                        <span className="text-sm">Loading recordings...</span>
                                    </div>
                                ) : recordings?.length === 0 ? (
                                    <div className="text-center py-12 text-muted-foreground text-sm px-4">
                                        <Film className="w-8 h-8 opacity-20 mx-auto mb-3" />
                                        <p>No recordings found.</p>
                                    </div>
                                ) : (
                                    recordings?.map((rec) => (
                                        <button
                                            key={rec.sessionId}
                                            onClick={() => { setSelectedSessionId(rec.sessionId); setPublishId(null); setIsPublishing(false); }}
                                            className={cn(
                                                "flex flex-col gap-1.5 p-3 rounded-md text-left transition-all border outline-none focus-visible:ring-2 focus-visible:ring-ring",
                                                selectedSessionId === rec.sessionId
                                                    ? "bg-accent text-accent-foreground border-accent-foreground/10 shadow-sm"
                                                    : "bg-transparent border-transparent text-muted-foreground hover:bg-muted/50 hover:text-foreground"
                                            )}
                                        >
                                            <div className="font-medium text-sm flex items-start gap-2 leading-none">
                                                <Film className={cn(
                                                    "w-3.5 h-3.5 mt-0.5 flex-shrink-0",
                                                    selectedSessionId === rec.sessionId ? "text-accent-foreground" : "text-muted-foreground"
                                                )} />
                                                <span className="line-clamp-2">{rec.title || "Untitled Recording"}</span>
                                            </div>
                                            <div className="flex items-center gap-3 text-xs text-muted-foreground pl-5.5">
                                                <span className="flex items-center gap-1">
                                                    <Calendar className="w-3 h-3" />
                                                    {new Date(rec.createdAt).toLocaleDateString()}
                                                </span>
                                                <span className="flex items-center gap-1">
                                                    <Clock className="w-3 h-3" />
                                                    {formatDuration(rec.duration)}
                                                </span>
                                                {rec.youtubeVideoId && (
                                                    <span className="flex items-center gap-1 text-red-500">
                                                        <ExternalLink className="w-3 h-3" />
                                                        YouTube
                                                    </span>
                                                )}
                                            </div>
                                        </button>
                                    ))
                                )}
                            </div>
                        </ScrollArea>
                    </div>

                    {/* Main Content - Player */}
                    <div className="flex-1 bg-black flex flex-col relative overflow-hidden">
                        {selectedSessionId ? (
                            <>
                                <div className="flex-1 w-full flex items-center justify-center relative bg-black/50">
                                    <MonorailPlayer
                                        key={selectedSessionId}
                                        sessionId={selectedSessionId}
                                        autoPlay={false}
                                    />
                                </div>
                                <div className="p-4 border-t border-border bg-background flex items-center justify-between gap-4">
                                    <div className="text-sm">
                                        <div className="font-medium">Publishing Controls</div>
                                        <div className="text-muted-foreground text-xs">Upload this recording to your connected YouTube channel</div>
                                    </div>

                                    <div className="flex items-center gap-3">
                                        {publishId && publishProgress ? (
                                            <div className="flex flex-col gap-1 min-w-[200px]">
                                                <div className="flex justify-between text-xs font-medium">
                                                    <span>{publishProgress.status}</span>
                                                    <span>{publishProgress.youtube?.bytesUploaded ? Math.round((publishProgress.youtube.bytesUploaded / publishProgress.totalBytes) * 100) : 0}%</span>
                                                </div>
                                                <div className="h-2 w-full bg-secondary rounded-full overflow-hidden">
                                                    <div
                                                        className="h-full bg-primary transition-all duration-300"
                                                        style={{ width: `${publishProgress.youtube?.bytesUploaded ? (publishProgress.youtube.bytesUploaded / publishProgress.totalBytes) * 100 : 0}%` }}
                                                    />
                                                </div>
                                                {publishProgress.status === 'DONE' && publishProgress.youtube?.videoId && (
                                                    <a
                                                        href={`https://youtu.be/${publishProgress.youtube.videoId}`}
                                                        target="_blank"
                                                        rel="noreferrer"
                                                        className="text-xs text-primary hover:underline mt-1"
                                                    >
                                                        View on YouTube
                                                    </a>
                                                )}
                                                {publishProgress.status === 'FAILED' && (
                                                    <span className="text-xs text-destructive">{publishProgress.error || "Upload failed"}</span>
                                                )}
                                            </div>
                                        ) : (
                                            <>
                                                {youtubeStatus?.connected ? (
                                                    <Button
                                                        size="sm"
                                                        onClick={() => handlePublish(selectedSessionId)}
                                                        disabled={isPublishing}
                                                    >
                                                        {isPublishing ? "Starting..." : "Upload to YouTube"}
                                                    </Button>
                                                ) : (
                                                    <Button size="sm" variant="outline" asChild>
                                                        <a href="/app/integrations" target="_blank">Connect YouTube</a>
                                                    </Button>
                                                )}
                                            </>
                                        )}

                                        {/* Show existing link if already uploaded */}
                                        {recordings?.find(r => r.sessionId === selectedSessionId)?.youtubeVideoId && !publishId && (
                                            <Button
                                                size="sm"
                                                variant="outline"
                                                asChild
                                                className="gap-2 text-red-600 border-red-200 hover:bg-red-50"
                                            >
                                                <a
                                                    href={`https://youtu.be/${recordings.find(r => r.sessionId === selectedSessionId)?.youtubeVideoId}`}
                                                    target="_blank"
                                                    rel="noreferrer"
                                                >
                                                    <ExternalLink className="w-4 h-4" />
                                                    View on YouTube
                                                </a>
                                            </Button>
                                        )}
                                    </div>
                                </div>
                            </>
                        ) : (
                            <div className="flex flex-col items-center justify-center text-white/20 gap-4 h-full">
                                <div className="p-6 rounded-full bg-white/5 border border-white/10">
                                    <Play className="w-12 h-12 ml-1" />
                                </div>
                                <p className="text-sm font-medium">Select a recording to start watching</p>
                            </div>
                        )}
                    </div>
                </div>
            </DialogContent>
        </Dialog>
    );
}

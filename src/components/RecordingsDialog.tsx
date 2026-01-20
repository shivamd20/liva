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
import { Play, Calendar, Clock, Film } from "lucide-react";
import { trpcClient } from '../trpcClient';
import { useQuery } from '@tanstack/react-query';
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

    return (
        <Dialog open={open} onOpenChange={onOpenChange}>
            <DialogContent className="w-[90vw] h-[85vh] sm:max-w-[90vw] p-0 gap-0 overflow-hidden flex flex-col bg-background text-foreground border-border shadow-lg sm:rounded-xl">
                <DialogHeader className="p-6 border-b border-border flex-shrink-0">
                    <DialogTitle className="text-xl font-semibold tracking-tight">Board Recordings</DialogTitle>
                    <DialogDescription className="text-muted-foreground">
                        Review and play back recorded sessions from this board.
                    </DialogDescription>
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
                                            onClick={() => setSelectedSessionId(rec.sessionId)}
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
                                            </div>
                                        </button>
                                    ))
                                )}
                            </div>
                        </ScrollArea>
                    </div>

                    {/* Main Content - Player */}
                    <div className="flex-1 bg-black flex items-center justify-center relative overflow-hidden">
                        {selectedSessionId ? (
                            // The player container is now flex-1 and takes full size
                            <div className="w-full h-full flex items-center justify-center">
                                <MonorailPlayer
                                    key={selectedSessionId}
                                    sessionId={selectedSessionId}
                                    autoPlay
                                />
                            </div>
                        ) : (
                            <div className="flex flex-col items-center justify-center text-white/20 gap-4">
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

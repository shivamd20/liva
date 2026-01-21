import { useEffect, useRef } from 'react';
import { useNavigate } from 'react-router-dom';
import { useCreateBoard } from '../hooks/useBoards';
import { Loader2 } from 'lucide-react';
import { mixpanelService, MixpanelEvents } from '../lib/mixpanel';
import { toast } from 'sonner';

export function NewBoardRedirect() {
    const navigate = useNavigate();
    const createBoard = useCreateBoard({
        onSuccess: (data) => {
            console.log('Board created successfully:', data);
            mixpanelService.track(MixpanelEvents.BOARD_CREATE, {
                boardId: data.id,
                source: 'direct_link'
            });
            toast.success("New board created!");
            navigate(`/board/${data.id}`, { replace: true });
        },
        onError: (error) => {
            console.error("Failed to create board:", error);
            toast.error("Failed to create new board. Please try again.");
            navigate('/board', { replace: true });
        }
    });

    const hasInitialised = useRef(false);

    // Trigger board creation once on mount
    useEffect(() => {
        if (hasInitialised.current) return;
        hasInitialised.current = true;

        createBoard.mutate({
            title: 'Untitled Board',
            expiresInHours: 0,
        });
    }, []); // eslint-disable-line react-hooks/exhaustive-deps

    return (
        <div className="h-screen w-screen flex items-center justify-center bg-background">
            <div className="flex flex-col items-center gap-4">
                <Loader2 className="h-8 w-8 animate-spin text-primary" />
                <p className="text-muted-foreground">Creating your board...</p>
            </div>
        </div>
    );
}

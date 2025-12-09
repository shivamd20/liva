import { useState, useEffect } from 'react';
import { useParams, useNavigate } from 'react-router-dom';
import { Excalidraw } from '@excalidraw/excalidraw';
import { ExcalidrawImperativeAPI } from '@excalidraw/excalidraw/types';
import '@excalidraw/excalidraw/index.css';
import { useExcalidrawLiveSync } from '../useExcalidrawLiveSync';
import { createExcalidrawBoard } from '../createBoard';

export function DemoLiveBoard() {
    const { boardId } = useParams<{ boardId: string }>();
    const navigate = useNavigate();
    const [excalidrawAPI, setExcalidrawAPI] = useState<ExcalidrawImperativeAPI | null>(null);
    const [isCreating, setIsCreating] = useState(false);

    // Generate a random user for demo purposes
    const [userInfo] = useState(() => ({
        username: `User-${Math.floor(Math.random() * 1000)}`,
        avatarUrl: `https://api.dicebear.com/7.x/avataaars/svg?seed=${Math.floor(Math.random() * 1000)}`,
        color: {
            background: '#' + Math.floor(Math.random() * 16777215).toString(16),
            stroke: '#' + Math.floor(Math.random() * 16777215).toString(16)
        }
    }));

    // Auto-create board if no ID
    useEffect(() => {
        // If we are at /demoLiveAPI (no ID), this component might not even match if route is /:boardId
        // But if we have an optional param or root route..
        // Actually, currently App.tsx has `/demoLiveAPI/:boardId`.
        // The user likely wants `/demoLiveAPI` to also work.
        // But let's assume if they hit a "magic" ID like 'new', we create.

        if (boardId === 'new') {
            setIsCreating(true);
            createExcalidrawBoard('Demo Board')
                .then(id => {
                    navigate(`/demoLiveAPI/${id}`, { replace: true });
                })
                .catch(err => {
                    console.error(err);
                    alert('Failed to create board');
                });
        }
    }, [boardId, navigate]);

    const { handleChange, onPointerUpdate } = useExcalidrawLiveSync({
        excalidrawAPI,
        boardId: boardId || '', // Pass empty if creating, hook handles it gracefully or we skip
        userInfo,
    });

    if (boardId === 'new' || isCreating) {
        return <div className="flex items-center justify-center h-screen">Creating new board...</div>;
    }

    // If user navigates to a non-existent board, the socket might fail silent or we could handle generic errors.
    // For this demo, we assume ID is valid or we just show blank.

    return (
        <div style={{ width: '100vw', height: '100vh' }}>
            <h1 style={{
                position: 'absolute',
                bottom: 10,
                left: '50%',
                transform: 'translateX(-50%)',
                zIndex: 10,
                background: 'white',
                padding: '5px 10px',
                borderRadius: 5,
                boxShadow: '0 2px 5px rgba(0,0,0,0.1)'
            }}>
                Live Sync Demo: {boardId} ({userInfo.username})
            </h1>
            <Excalidraw
                excalidrawAPI={(api) => setExcalidrawAPI(api)}
                onChange={handleChange}
                onPointerUpdate={onPointerUpdate}
                UIOptions={{
                    canvasActions: {
                        loadScene: false,
                    }
                }}
            />
        </div>
    );
}

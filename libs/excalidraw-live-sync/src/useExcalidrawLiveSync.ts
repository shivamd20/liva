import { useEffect, useRef, useCallback, useState } from 'react';
import { ExcalidrawImperativeAPI, Collaborator, SocketId, AppState, BinaryFileData } from '@excalidraw/excalidraw/types';
import { OrderedExcalidrawElement } from '@excalidraw/excalidraw/element/types';
import { liveSyncClient, ConnectionStatus } from './LiveSyncClient';

export interface UserInfo {
    username?: string;
    avatarUrl?: string;
    color?: { background: string; stroke: string };
}

export interface UseExcalidrawLiveSyncProps {
    excalidrawAPI: ExcalidrawImperativeAPI | null;
    boardId: string;
    userId: string; // Mandatory userId
    userInfo?: UserInfo;
    debounceMs?: number;
    baseUrl?: string;
}

// Version-based merge logic (Duplicate to keep independent)
function mergeElements(
    local: readonly OrderedExcalidrawElement[],
    incoming: OrderedExcalidrawElement[]
): OrderedExcalidrawElement[] {
    const localMap = new Map(local.map((e) => [e.id, e]));
    const incomingMap = new Map(incoming.map((e) => [e.id, e]));
    const result = new Map(localMap);

    for (const [id, incomingEl] of incomingMap) {
        const localEl = localMap.get(id);
        if (!localEl) {
            result.set(id, incomingEl);
        } else {
            const localVersion = localEl.version || 0;
            const incomingVersion = incomingEl.version || 0;
            if (incomingVersion > localVersion) {
                result.set(id, incomingEl);
            }
        }
    }
    return Array.from(result.values());
}

export function useExcalidrawLiveSync({
    excalidrawAPI,
    boardId,
    userId,
    userInfo = { username: 'Anonymous' },
    debounceMs = 50,
    baseUrl = 'https://liva.shvm.in',
}: UseExcalidrawLiveSyncProps) {

    // -- Resolve Effective User ID --
    // We want a persistent ID for guests so that their cursors don't flicker or conflict
    const [effectiveUserId, setEffectiveUserId] = useState<string>('');

    useEffect(() => {
        if (userId && userId !== 'anonymous') {
            setEffectiveUserId(userId);
        } else {
            // Check for stored guest ID
            if (typeof window !== 'undefined') {
                let guestId = localStorage.getItem('liva_guest_id');
                if (!guestId) {
                    guestId = `guest_${Math.random().toString(36).substring(2, 9)}`;
                    localStorage.setItem('liva_guest_id', guestId);
                }
                setEffectiveUserId(guestId);
            } else {
                setEffectiveUserId('anonymous');
            }
        }
    }, [userId]);

    // Set base URL and User ID
    useEffect(() => {
        if (!effectiveUserId) return;
        liveSyncClient.setBaseUrl(baseUrl);
        liveSyncClient.setUserId(effectiveUserId);
    }, [baseUrl, effectiveUserId]);

    // -- Sync State --
    const lastElementsRef = useRef<readonly OrderedExcalidrawElement[]>([]);
    const lastRemoteUpdateRef = useRef<string>('');
    const lastBoardVersionRef = useRef<number>(0);
    const debounceTimeoutRef = useRef<ReturnType<typeof setTimeout> | undefined>(undefined);

    // -- Collaborators State --
    const [collaborators, setCollaborators] = useState<Map<SocketId, Collaborator>>(new Map());
    const [connectionStatus, setConnectionStatus] = useState<ConnectionStatus>('disconnected');

    // -- 1. Handle Local Changes (onChange) --
    // We accept any here to match Excalidraw's onChange(elements, appState, files)
    const handleChange = useCallback((elements: readonly any[], appState: AppState, files: Record<string, BinaryFileData>) => {
        // Snapshot immediately
        // We track both elements and files state
        const elementsSnapshot = JSON.stringify(elements);
        const filesSnapshot = JSON.stringify(files);
        const combinedSnapshot = elementsSnapshot + filesSnapshot;

        if (debounceTimeoutRef.current) clearTimeout(debounceTimeoutRef.current);

        debounceTimeoutRef.current = setTimeout(() => {
            if (combinedSnapshot !== lastRemoteUpdateRef.current) {
                // Determine if it was just an element change or files change or both
                // Actually we just send everything current state
                const parsedElements = JSON.parse(elementsSnapshot) as OrderedExcalidrawElement[];

                // Update our last known state to avoid echo
                lastElementsRef.current = parsedElements;
                lastRemoteUpdateRef.current = combinedSnapshot; // Mark as our change

                // Send to server
                liveSyncClient.sendUpdate({
                    id: boardId,
                    title: 'Untitled', // We can improve this if needed
                    excalidrawElements: parsedElements,
                    files: files as unknown as Record<string, BinaryFileData>,
                    updatedAt: Date.now()
                });
            }
        }, debounceMs);
    }, [boardId, debounceMs]);


    // -- 2. Handle Remote Changes & Connection Status --
    useEffect(() => {
        if (!excalidrawAPI) return;
        if (!effectiveUserId) return; // Wait for user ID

        const unsubscribe = liveSyncClient.subscribe(boardId, (remoteBoard) => {
            // Prevent loop: if version is self-same
            if (remoteBoard.updatedAt === lastBoardVersionRef.current) return;

            // Prevent loop: if content is exactly what we just sent
            const incomingElementsStr = JSON.stringify(remoteBoard.excalidrawElements);
            const incomingFilesStr = JSON.stringify(remoteBoard.files || {});
            const incomingSnapshot = incomingElementsStr + incomingFilesStr;

            if (incomingSnapshot === lastRemoteUpdateRef.current) {
                lastBoardVersionRef.current = remoteBoard.updatedAt;
                return;
            }

            // Sync Files
            if (remoteBoard.files) {
                excalidrawAPI.addFiles(Object.values(remoteBoard.files));
            }

            // Sync Elements
            const currentElements = excalidrawAPI.getSceneElements();
            const merged = mergeElements(currentElements, remoteBoard.excalidrawElements);

            if (JSON.stringify(merged) !== JSON.stringify(currentElements)) {
                excalidrawAPI.updateScene({
                    elements: merged,
                    // We don't mess with appState mostly
                });
                lastElementsRef.current = merged;
            }
            lastBoardVersionRef.current = remoteBoard.updatedAt;
        });

        // Subscribe to status updates
        const unsubscribeStatus = liveSyncClient.subscribeStatus(boardId, (status) => {
            setConnectionStatus(status);
        });

        return () => {
            unsubscribe();
            unsubscribeStatus();
        };
    }, [excalidrawAPI, boardId, effectiveUserId]);


    // -- 3. Handle Cursors & Ephemeral State --
    useEffect(() => {
        if (!excalidrawAPI) return;
        if (!effectiveUserId) return;

        const handleEphemeral = (msg: any) => {
            if (msg.type === 'ephemeral') {
                const { senderId, data } = msg;
                if (data === null) {
                    // User disconnected
                    setCollaborators(prev => {
                        const next = new Map(prev);
                        next.delete(senderId);
                        return next;
                    });
                    return;
                }

                if (data.type === 'pointer') {
                    if (data.payload.userId === effectiveUserId) return;

                    setCollaborators(prev => {
                        const next = new Map(prev);
                        next.set(senderId, {
                            id: senderId,
                            username: data.payload.username || 'User',
                            avatarUrl: data.payload.avatarUrl,
                            color: data.payload.color || { background: '#999', stroke: '#999' },
                            pointer: {
                                x: data.payload.pointer.x,
                                y: data.payload.pointer.y,
                                tool: "pointer"
                            }
                        });
                        return next;
                    });
                }

            } else if (msg.type === 'ephemeral_state') {
                // Bulk initial state
                const newCalls = new Map<SocketId, Collaborator>();
                Object.entries(msg.data).forEach(([id, data]: [string, any]) => {
                    if (data && data.type === 'pointer') {
                        if (data.payload.userId === effectiveUserId) return;

                        newCalls.set(id as SocketId, {
                            id: id,
                            username: data.payload.username || 'User',
                            avatarUrl: data.payload.avatarUrl,
                            color: data.payload.color || { background: '#999', stroke: '#999' },
                            pointer: {
                                x: data.payload.pointer.x,
                                y: data.payload.pointer.y,
                                tool: "pointer"
                            }
                        });
                    }
                });
                setCollaborators(newCalls);
            }
        };

        const unsubscribe = liveSyncClient.subscribeEphemeral(boardId, handleEphemeral);
        return () => unsubscribe();
    }, [excalidrawAPI, boardId, effectiveUserId]);


    // -- 4. Update Collaborators in Excalidraw --
    useEffect(() => {
        if (excalidrawAPI) {
            excalidrawAPI.updateScene({ collaborators });
        }
    }, [excalidrawAPI, collaborators]);


    // -- 5. Pointer Updates --
    const onPointerUpdate = useCallback((payload: { pointer: { x: number; y: number }, button: 'down' | 'up', pointersMap: any }) => {
        if (!effectiveUserId) return;

        liveSyncClient.sendEphemeral(boardId, {
            type: 'pointer',
            payload: {
                pointer: payload.pointer,
                button: payload.button,
                userId: effectiveUserId,
                username: userInfo.username,
                avatarUrl: userInfo.avatarUrl,
                color: userInfo.color,
            }
        });
    }, [boardId, userInfo, effectiveUserId]);

    const reconnect = useCallback(() => {
        liveSyncClient.reconnect(boardId);
    }, [boardId]);

    return {
        handleChange,
        onPointerUpdate,
        connectionStatus,
        reconnect
    };
}

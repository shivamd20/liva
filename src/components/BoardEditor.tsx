/**
 * BoardEditor - Premium mobile-responsive Excalidraw component
 * 
 * Features:
 * - Responsive layout with mobile/tablet/desktop optimizations
 * - Dynamic toolbar positioning based on screen size
 * - Touch-friendly UI with proper target sizes
 * - Safe area insets for notched devices
 * - Optimized UI options per device type
 */
import { Board } from '../types';
import { Excalidraw, MainMenu } from '@excalidraw/excalidraw';
import { Sparkles } from 'lucide-react';
import { Share2, MessageCircle, Globe } from 'lucide-react';
import { AssistantPanel } from './AssistantPanel';
import { TopBar } from './TopBar';
import { ExcalidrawImperativeAPI, SocketId, Collaborator } from '@excalidraw/excalidraw/types';
import { cn } from '../lib/utils';
import { OrderedExcalidrawElement, NonDeletedExcalidrawElement } from '@excalidraw/excalidraw/element/types';
import '@excalidraw/excalidraw/index.css';
import '../styles/excalidraw-custom.css';
// import '../styles/excalidraw-mobile.css';
import { ReactNode, useRef, useCallback, useEffect, useState, useMemo } from 'react';
import { useExcalidrawLiveSync } from '@shvm/excalidraw-live-sync';
import { useResponsive } from '../hooks/useResponsive';
import { boardsAPI as defaultBoardsAPI } from '../boardsConfig';
import { BoardsAPI } from '../boards';
import { useQueryClient } from '@tanstack/react-query';
import { getUserProfile } from '../utils/userIdentity';
import { useSession } from '../lib/auth-client';
import { toast } from 'sonner';
import { useTheme } from 'next-themes';
import { useCommandMenu } from '../lib/command-menu-context';
import { trpcClient } from '../trpcClient';
import { mixpanelService, MixpanelEvents } from '../lib/mixpanel';
import { SpeechProvider } from '../contexts/SpeechContext';
import { useQuery } from '@tanstack/react-query';
import { TopBarMenuItem } from './TopBar';
import { MonorailRecorder } from '@shvm/monorail';
import { RecordingsDialog } from './RecordingsDialog';
import { useMutation } from '@tanstack/react-query';

interface BoardEditorProps {
  board: Board;
  onChange: (board: Board) => void;
  menuItems?: TopBarMenuItem[];
  syncEnabled?: boolean;
  onPointerDown?: (activeTool: any, pointerDownState: any) => void;
  boardsAPI?: BoardsAPI;
  onLinkOpen?: (element: NonDeletedExcalidrawElement, event: CustomEvent<{ nativeEvent: MouseEvent | React.PointerEvent<HTMLCanvasElement> }>) => void;
  onBack?: () => void;
  onTitleChange?: (newTitle: string) => void;
  onConnectYouTube?: () => void;
}

export function BoardEditor({
  board,
  // onChange is now unused in favor of updateViaWS, but kept for props interface
  onChange,
  menuItems,
  syncEnabled = true,
  onPointerDown,
  boardsAPI = defaultBoardsAPI,
  onLinkOpen,
  onBack,
  onTitleChange,
  onConnectYouTube
}: BoardEditorProps) {
  const [excalidrawAPI, setExcalidrawAPI] = useState<ExcalidrawImperativeAPI | null>(null);
  const excalidrawAPIRef = useRef<ExcalidrawImperativeAPI | null>(null);

  useEffect(() => {
    if (excalidrawAPI) {
      excalidrawAPIRef.current = excalidrawAPI;
    }
  }, [excalidrawAPI]);
  const queryClient = useQueryClient();

  const { data: session } = useSession();
  const userProfile = useMemo(() => getUserProfile(session), [session]);
  const userId = session?.user?.id;
  const isOwner = !!(userId && userId === board.userId);
  const { isMobile, isTablet } = useResponsive();
  const { theme } = useTheme();

  // ... imports


  const { registerCommand, unregisterCommand } = useCommandMenu();

  // Recording State
  const [isRecording, setIsRecording] = useState(false);
  const [recordingSessionId, setRecordingSessionId] = useState<string | null>(null);
  const [recordingStartTime, setRecordingStartTime] = useState<number | null>(null);
  const [recordingDuration, setRecordingDuration] = useState(0);
  const [isMuted, setIsMuted] = useState(false);
  const [isVideoEnabled, setIsVideoEnabled] = useState(false);
  const [isRecordingsOpen, setIsRecordingsOpen] = useState(false);

  // Auto-Upload State
  const [uploadStatus, setUploadStatus] = useState<'INIT' | 'UPLOADING_TO_YT' | 'DONE' | 'FAILED' | null>(null);
  const [uploadProgress, setUploadProgress] = useState(0);
  const [uploadPublishId, setUploadPublishId] = useState<string | null>(null);

  const { createSession } = trpcClient.monorail;

  // Mutations for upload
  const { mutateAsync: initPublish } = useMutation({
    mutationFn: (sessionId: string) => trpcClient.monorail.initPublish.mutate({ monorailSessionId: sessionId })
  });

  const { mutateAsync: startPublish } = useMutation({
    mutationFn: (pId: string) => trpcClient.monorail.startPublish.mutate({ publishId: pId })
  });

  const { mutateAsync: updateRecordingYouTubeId } = useMutation({
    mutationFn: (data: { id: string, sessionId: string, videoId: string }) =>
      trpcClient.updateRecordingYouTubeId.mutate(data)
  });

  // Polling for upload progress
  useQuery({
    queryKey: ['publish-progress', uploadPublishId],
    queryFn: async () => {
      if (!uploadPublishId) return null;
      const progress = await trpcClient.monorail.getPublishProgress.query({ publishId: uploadPublishId });

      setUploadStatus(progress.status as any);
      if (progress.youtube?.bytesUploaded && progress.totalBytes) {
        setUploadProgress(progress.youtube.bytesUploaded / progress.totalBytes);
      }

      if (progress.status === 'DONE' && progress.youtube?.videoId) {
        // Persist video ID
        await updateRecordingYouTubeId({
          id: board.id,
          sessionId: progress.monorailSessionId,
          videoId: progress.youtube.videoId
        });
        setUploadPublishId(null); // Stop polling
        toast.success("Recording uploaded to YouTube!");
        queryClient.invalidateQueries({ queryKey: ['recordings', board.id] });
      } else if (progress.status === 'FAILED') {
        setUploadPublishId(null); // Stop polling
        toast.error("YouTube upload failed: " + progress.error);
      }

      return progress;
    },
    enabled: !!uploadPublishId,
    refetchInterval: 1000
  });

  const recorderRef = useRef<MonorailRecorder | null>(null);
  const previewVideoRef = useRef<HTMLVideoElement | null>(null);
  const excalidrawContainerRef = useRef<HTMLDivElement | null>(null);

  // Separate refs for audio and video streams to manage them independently
  const audioStreamRef = useRef<MediaStream | null>(null);
  const videoStreamRef = useRef<MediaStream | null>(null);

  useEffect(() => {
    let interval: NodeJS.Timeout;
    if (isRecording && recordingStartTime) {
      interval = setInterval(() => {
        setRecordingDuration(Math.floor((Date.now() - recordingStartTime) / 1000));
      }, 1000);
    }
    return () => clearInterval(interval);
  }, [isRecording, recordingStartTime]);

  const toggleMute = useCallback(() => {
    if (audioStreamRef.current) {
      const audioTracks = audioStreamRef.current.getAudioTracks();
      audioTracks.forEach(track => {
        track.enabled = !track.enabled;
      });
      setIsMuted(prev => !prev);
    }
  }, []);

  const toggleVideo = useCallback(async () => {
    try {
      if (isVideoEnabled) {
        // Turn Video OFF
        if (recorderRef.current) {
          await recorderRef.current.removeCamera();
        }

        if (videoStreamRef.current) {
          videoStreamRef.current.getTracks().forEach(track => track.stop());
          videoStreamRef.current = null;
        }
        setIsVideoEnabled(false);
      } else {
        // Turn Video ON
        const videoStream = await navigator.mediaDevices.getUserMedia({
          video: {
            width: { ideal: 1280 },
            height: { ideal: 720 }
          },
          audio: false // We already have audio
        });

        videoStreamRef.current = videoStream;

        if (recorderRef.current) {
          await recorderRef.current.addCamera(videoStream);
        }
        setIsVideoEnabled(true);
      }
    } catch (e) {
      console.error("[Recording] Failed to toggle video:", e);
      toast.error("Could not access camera");
      // Ensure state is synced if error occurred
      setIsVideoEnabled(false);
    }
  }, [isVideoEnabled]);

  const startRecording = async () => {
    try {
      console.log("[Recording] Starting recording...");
      // 1. Create Session
      const res = await fetch('/api/v1/monorail.createSession', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ sessionId: undefined })
      });
      if (!res.ok) throw new Error("Failed to create session");
      const responseData = await res.json() as any;
      const session = responseData.result.data;

      setRecordingSessionId(session.id);

      // 2. Associate recording with board IMMEDIATELY
      console.log('[Recording] Associating with board:', {
        boardId: board.id,
        sessionId: session.id
      });

      try {
        await trpcClient.addRecording.mutate({
          id: board.id,
          sessionId: session.id,
          duration: 0, // Will be updated on finalization
          title: `Recording ${new Date().toLocaleString()}`
        });
        console.log('[Recording] Successfully associated with board');

        // Invalidate recordings list to show the new (in-progress) recording
        await queryClient.invalidateQueries({ queryKey: ['recordings', board.id] });
      } catch (associateError) {
        console.error('[Recording] Failed to associate with board:', associateError);
        // Don't fail the recording start, but log it
        toast.error("Recording started but not linked to board");
      }

      // 3. Setup Recorder
      const recorder = new MonorailRecorder({
        sessionId: session.id,
        getUploadUrl: async (index) => {
          return `/api/monorail/session/${session.id}/upload/${index}`;
        }
      });

      // 4. Media - Start with Audio ONLY as per requirements
      const audioStream = await navigator.mediaDevices.getUserMedia({
        audio: true,
        video: false
      });
      audioStreamRef.current = audioStream;

      // Register audio stream with recorder
      await recorder.addAudio(audioStream);

      // Add container source
      if (excalidrawContainerRef.current) {
        await recorder.addContainer(excalidrawContainerRef.current);
      }

      // Note: Video is intentionally NOT added initially. 
      // It can be enabled later by the user via toggleVideo.

      await recorder.start();
      recorderRef.current = recorder;

      // Preview (will show canvas initially)
      if (previewVideoRef.current) {
        const stream = recorder.getStream();
        if (stream) {
          previewVideoRef.current.srcObject = stream;
          previewVideoRef.current.play().catch(e => console.error("Preview play failed", e));
        }
      }

      setIsRecording(true);
      setRecordingStartTime(Date.now());
      setIsVideoEnabled(false); // Default to video off
      setIsMuted(false);
      toast.success("Recording started");

    } catch (e) {
      console.error("[Recording] Start error:", e);
      toast.error("Failed to start recording: " + (e as Error).message);
    }
  };

  const stopRecording = async () => {
    if (!recorderRef.current) return;
    try {
      const sessionId = recordingSessionId;
      const finalDuration = recordingDuration;

      console.log('[Recording] Stopping recorder...');
      await recorderRef.current.stop();

      // Stop all media tracks
      if (audioStreamRef.current) {
        audioStreamRef.current.getTracks().forEach(track => track.stop());
        audioStreamRef.current = null;
      }

      if (videoStreamRef.current) {
        videoStreamRef.current.getTracks().forEach(track => track.stop());
        videoStreamRef.current = null;
      }

      recorderRef.current = null;
      setIsRecording(false);
      setRecordingStartTime(null);
      setRecordingDuration(0);

      if (previewVideoRef.current) {
        previewVideoRef.current.srcObject = null;
      }

      if (sessionId) {
        try {
          console.log('[Recording] Signaling stop to Durable Object...');

          // Signal stop to the Durable Object
          // This sets a 5-second alarm that will automatically finalize the session
          // after all pending uploads complete (avoiding race conditions)
          await trpcClient.monorail.signalStop.mutate({ sessionId });

          console.log('[Recording] Stop signal sent. Session will auto-finalize after pending uploads.');

          console.log('[Recording] Updating recording duration:', {
            boardId: board.id,
            sessionId,
            duration: finalDuration
          });

          // Update the recording with final duration
          await trpcClient.addRecording.mutate({
            id: board.id,
            sessionId,
            duration: finalDuration,
            title: `Recording ${new Date().toLocaleString()}`
          });

          console.log('[Recording] Recording updated successfully');

          await queryClient.invalidateQueries({ queryKey: ['board', board.id] });
          await queryClient.invalidateQueries({ queryKey: ['recordings', board.id] });

          toast.success("Recording saved! Processing...");
        } catch (saveError) {
          console.error('[Recording] Failed to finalize/save recording:', saveError);
          toast.error("Recording completed but failed to save to board");
        }

        // Auto-Upload Logic
        try {
          // Check if connected
          const res = await fetch('/api/integrations/youtube');
          if (res.ok) {
            const data = await res.json() as { connected: boolean };
            if (data.connected) {
              console.log('[Recording] YouTube connected, starting auto-upload...');
              setUploadStatus('INIT');
              const init = await initPublish(sessionId);
              setUploadPublishId(init.publishId);
              await startPublish(init.publishId);
            }
          }
        } catch (uploadError) {
          console.error('[Recording] Auto-upload failed to start:', uploadError);
          // Don't toast error here to avoid noise, user can check status
        }
      }
    } catch (e) {
      console.error("[Recording] Stop error:", e);
      toast.error("Error stopping recording");
    }
  };


  // Use the library for syncing
  const { handleChange, onPointerUpdate } = useExcalidrawLiveSync({
    excalidrawAPI: excalidrawAPIRef.current,
    boardId: board.id,
    userId: userId || 'anonymous',
    userInfo: {
      username: userProfile.username,
      avatarUrl: userProfile.avatarUrl,
      color: userProfile.color,
    },
    baseUrl: typeof window !== 'undefined' ? window.location.origin : undefined,
  });

  useEffect(() => {
    window.document.title = board.title
  }, [
    board.title
  ])



  // Responsive UI options based on device type
  const uiOptions = useMemo(() => {
    // Mobile: simplified UI
    if (isMobile) {
      return {
        canvasActions: {
          loadScene: false as const,
          changeViewBackgroundColor: false as const,
          export: false as const,
        },
        dockedSidebarBreakpoint: 0,
      } as const;
    }

    // Tablet: balanced UI
    if (isTablet) {
      return {
        canvasActions: {
          loadScene: false as const,
        },
        dockedSidebarBreakpoint: 768,
      } as const;
    }

    // Desktop: full UI
    return {
      canvasActions: {
        loadScene: false as const,
      },
    } as const;
  }, [isMobile, isTablet]);

  const handleAskAI = useCallback(async () => {
    const instruction = window.prompt("What would you like to do with this board?");
    if (!instruction) return;

    const toastId = toast.loading("AI is thinking...");
    mixpanelService.track(MixpanelEvents.AI_GENERATE_START, { boardId: board.id, queryLength: instruction.length });

    try {
      const elements = excalidrawAPIRef.current?.getSceneElements();
      if (!elements) throw new Error("Could not get board elements");

      const result = await trpcClient.ai.transformWithAI.mutate({
        query: instruction,
        elements: elements as any,
        constraints: {
          allowDelete: true,
          allowNewElements: true,
        }
      });

      if (result && result.updatedElements) {
        const updatedElements = result.updatedElements as unknown as OrderedExcalidrawElement[];

        // Update local scene
        excalidrawAPIRef.current?.updateScene({
          elements: updatedElements
        });

        // Sync changes
        handleChange(updatedElements);

        toast.success("Board updated by AI", { id: toastId });
        mixpanelService.track(MixpanelEvents.AI_GENERATE_SUCCESS, { boardId: board.id });
      } else {
        toast.error("AI returned no changes", { id: toastId });
        mixpanelService.track(MixpanelEvents.AI_GENERATE_ERROR, { boardId: board.id, reason: 'No changes' });
      }

    } catch (error) {
      console.error(error);
      toast.error("Failed to process AI request", { id: toastId });
      mixpanelService.track(MixpanelEvents.AI_GENERATE_ERROR, { boardId: board.id, error: String(error) });
    }
  }, [board, boardsAPI]);

  useEffect(() => {
    const command = {
      id: 'ask-ai',
      title: 'Ask AI',
      icon: <Sparkles className="w-4 h-4" />,
      action: handleAskAI,
      section: 'AI Tools',
      shortcut: ['Meta', 'J']
    };

    registerCommand(command);
    return () => unregisterCommand(command.id);
  }, [registerCommand, unregisterCommand, handleAskAI]);

  // Handle pointer events with touch sensitivity adjustments
  // Handle pointer events with touch sensitivity adjustments
  const handlePointerDown = useCallback(
    (activeTool: any, pointerDownState: any) => {
      // Reduce gesture sensitivity on touch devices if needed
      if (pointerDownState.pointerType === 'touch' && isMobile) {
        // Touch-specific handling can be added here
      }
      onPointerDown?.(activeTool, pointerDownState);
    },
    [onPointerDown, isMobile]
  );

  const [activePanelTab, setActivePanelTab] = useState<'share' | 'conversation' | null>(null);
  const [isPanelPinned, setIsPanelPinned] = useState(true);

  const togglePanel = (tab: 'share' | 'conversation') => {
    setActivePanelTab(current => current === tab ? null : tab);
  };

  return (
    <SpeechProvider excalidrawAPIRef={excalidrawAPIRef}>
      <div className="flex h-full w-full overflow-hidden relative bg-background flex-col">
        <TopBar
          board={board}
          menuItems={menuItems || []}
          onToggleShare={() => togglePanel('share')}
          onToggleChat={() => togglePanel('conversation')}
          isShareOpen={activePanelTab === 'share'}
          isChatOpen={activePanelTab === 'conversation'}
          onBack={onBack || (() => { })}
          onTitleChange={onTitleChange || (() => { })}
          onConnectYouTube={onConnectYouTube}

          onToggleRecordings={() => setIsRecordingsOpen(true)}

          isRecording={isRecording}
          onStartRecording={startRecording}
          onStopRecording={stopRecording}
          recordingDuration={recordingDuration}
          onToggleMute={toggleMute}
          isMuted={isMuted}
          onToggleVideo={toggleVideo}
          isVideoEnabled={isVideoEnabled}
          recordingSessionId={recordingSessionId}

          uploadStatus={uploadStatus}
          uploadProgress={uploadProgress}
        />

        <div className="flex-1 relative flex overflow-hidden w-full h-full">
          <div
            ref={excalidrawContainerRef}
            className={cn(
              "h-full transition-all duration-300 ease-in-out relative bg-white dark:bg-neutral-950",
              (activePanelTab && isPanelPinned) ? "flex-1 w-[calc(100%-400px)]" : "w-full"
            )}>
            <Excalidraw
              viewModeEnabled={!!(board.expiresAt && Date.now() > board.expiresAt)}
              excalidrawAPI={(api) => setExcalidrawAPI(api)}
              theme={theme == 'dark' ? 'dark' : 'light'}
              initialData={{
                elements: board.excalidrawElements || [],
              }}
              onChange={(elements) => {
                handleChange(elements);
              }}
              isCollaborating={board.access === 'public'}
              UIOptions={uiOptions}
              // renderTopRightUI is removed as it's now in TopBar
              onPointerUpdate={onPointerUpdate}
              onPointerDown={handlePointerDown}
              onLinkOpen={onLinkOpen}
            >
            </Excalidraw>

            {/* Live Preview */}
            <div className={cn(
              "absolute bottom-4 right-4 z-50 w-64 aspect-video bg-black rounded-lg overflow-hidden shadow-lg border border-neutral-800 transition-all duration-300",
              isRecording ? "opacity-100 translate-y-0" : "opacity-0 translate-y-10 pointer-events-none"
            )}>
              <video
                ref={previewVideoRef}
                className="w-full h-full object-cover"
                muted
                playsInline
              />
            </div>
          </div>

          <div className={cn(
            "fixed top-12 bottom-0 right-0 z-[50] w-[400px] bg-background border-l shadow-2xl transition-transform duration-300 ease-in-out",
            activePanelTab ? "translate-x-0" : "translate-x-full"
          )}>
            <AssistantPanel
              isOpen={!!activePanelTab}
              activeTab={activePanelTab}
              isPinned={isPanelPinned}
              onTogglePin={() => setIsPanelPinned(!isPanelPinned)}
              onClose={() => setActivePanelTab(null)}
              board={board}
              isOwner={isOwner}
            />
          </div>
        </div>

        <RecordingsDialog
          open={isRecordingsOpen}
          onOpenChange={setIsRecordingsOpen}
          boardId={board.id}
        />
      </div >
    </SpeechProvider >
  );
}

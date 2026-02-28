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
import { WifiOff } from 'lucide-react';
import { AssistantPanel } from './AssistantPanel';
import { VoiceOrb, deriveOrbState } from '@/voice/VoiceOrb';
import { useVani2Transcription } from '@/voice/useVani2Transcription';
import { useVani2Session } from '@/voice/useVani2Session';
import { exportToBlob } from '@excalidraw/excalidraw';
import { TopBar } from './TopBar';
import { ExcalidrawImperativeAPI, SocketId, Collaborator } from '@excalidraw/excalidraw/types';
import { cn } from '../lib/utils';
import { NonDeletedExcalidrawElement } from '@excalidraw/excalidraw/element/types';
import '@excalidraw/excalidraw/index.css';
import '../styles/excalidraw-custom.css';
// import '../styles/excalidraw-mobile.css';
import { ReactNode, useRef, useCallback, useEffect, useState, useMemo } from 'react';
import { useExcalidrawLiveSync } from '@shvm/excalidraw-live-sync';
import { useResponsive } from '../hooks/useResponsive';
import { boardsAPI as defaultBoardsAPI } from '../boardsConfig';
import { BoardsAPI } from '../boards';
import { useQueryClient } from '@tanstack/react-query';
import { getUserProfile } from '../lib/userIdentity';
import { useSession } from '../lib/auth-client';
import { toast } from 'sonner';
import { useTheme } from 'next-themes';
import { trpcClient } from '../trpcClient';
import { mixpanelService, MixpanelEvents } from '../lib/mixpanel';
import { useQuery } from '@tanstack/react-query';
import { TopBarMenuItem } from './TopBar';
import { MonorailRecorder } from '@shvm/monorail';
import { useMutation } from '@tanstack/react-query';
import { useRemoteFileHandler } from '../hooks/useRemoteFileHandler';
import { useNavigate } from 'react-router-dom';
import { useTrackBoardAccess } from '../hooks/useBoards';

const VOICE_SYSTEM_PROMPT = `You are Liva, a creative collaborator who helps people think visually on their whiteboard. You talk like a smart coworker — casual, direct, and genuinely interested in what they're building.

HOW TO SPEAK:
- Short sentences. Plain words. No filler.
- Use contractions naturally: "I'll", "let's", "that's", "here's".
- Never output markdown, bullet points, asterisks, or numbered lists. This is spoken audio.
- Acknowledge briefly before answering: "Sure", "Got it", "Okay so".
- 2-3 sentences per response. If the topic is complex, give a one-line summary and ask if they want the full version.
- When you see board content, describe what you actually see — specific shapes, text, arrows, clusters. Use spatial language: "that group on the left", "the arrow going from X to Y".

WHEN THE USER IS THINKING:
If they trail off, say "hmm", "let me think", or seem to be working through an idea — just give a short acknowledgment or stay quiet. Don't jump in with answers.

USING TOOLS:
You have three tools. Always say what you're doing before calling one.

read_board — Takes a screenshot of the board. Call this when they ask you to look at, describe, or review the board, or when you need context about what's on it.

add_sticky_note — Places a colored sticky note. Call when they want something written down on the board. Keep text concise. Pick a meaningful color: yellow=general, blue=ideas, green=decisions, pink=urgent, orange=blockers.

highlight_area — Highlights the board to draw attention to a region.

PERSONALITY:
Match the user's energy. Be opinionated when asked. You're a collaborator, not an assistant.`;

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
  onTitleChange
}: BoardEditorProps) {
  const navigate = useNavigate();
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

  // Voice orb state
  const voiceTranscription = useVani2Transcription(undefined, board.id);
  const runBoardTool = useCallback(async (name: string, _args?: unknown): Promise<unknown> => {
    const api = excalidrawAPIRef.current;
    if (!api) return { error: "Board not available" };

    if (name === "read_board") {
      try {
        const blob = await exportToBlob({
          elements: api.getSceneElements(),
          appState: { ...api.getAppState(), exportWithDarkMode: false, exportScale: 2 },
          files: api.getFiles(),
          mimeType: "image/png",
          quality: 0.8,
        });
        return new Promise((resolve, reject) => {
          const reader = new FileReader();
          reader.onloadend = () => resolve({ image: reader.result as string });
          reader.onerror = reject;
          reader.readAsDataURL(blob);
        });
      } catch (e: any) {
        return { error: e?.message ?? "Export failed" };
      }
    }

    if (name === "add_sticky_note") {
      try {
        const args = (_args && typeof _args === "object") ? _args as Record<string, unknown> : {};
        const text = typeof args.text === "string" ? args.text : "Note";
        const colorName = typeof args.color === "string" ? args.color : "yellow";
        const colorMap: Record<string, string> = {
          yellow: "#FFF3B0", blue: "#a5d8ff", green: "#b2f2bb",
          pink: "#fcc2d7", orange: "#ffd8a8",
        };
        const strokeMap: Record<string, string> = {
          yellow: "#e8a838", blue: "#1971c2", green: "#2f9e44",
          pink: "#c2255c", orange: "#e8590c",
        };
        const bgColor = colorMap[colorName] || colorMap.yellow;
        const strokeColor = strokeMap[colorName] || strokeMap.yellow;
        const appState = api.getAppState();
        const zoom = appState.zoom?.value || 1;
        const viewportCenterX = (-appState.scrollX + (appState.width || 800) / 2) / zoom;
        const viewportCenterY = (-appState.scrollY + (appState.height || 600) / 2) / zoom;
        const jitterX = (Math.random() - 0.5) * 120;
        const jitterY = (Math.random() - 0.5) * 80;
        const NOTE_W = 220;
        const NOTE_H = 120;
        const rectId = crypto.randomUUID();
        const textId = crypto.randomUUID();
        const sharedProps = {
          angle: 0,
          opacity: 100,
          isDeleted: false,
          groupIds: [],
          link: null,
          locked: false,
          version: 1,
          versionNonce: Math.floor(Math.random() * 1000000),
          updated: Date.now(),
          seed: Math.floor(Math.random() * 1000000),
        };
        const rect = {
          ...sharedProps,
          id: rectId,
          type: "rectangle" as const,
          x: viewportCenterX - NOTE_W / 2 + jitterX,
          y: viewportCenterY - NOTE_H / 2 + jitterY,
          width: NOTE_W,
          height: NOTE_H,
          backgroundColor: bgColor,
          strokeColor,
          fillStyle: "solid" as const,
          strokeWidth: 2,
          roughness: 1,
          roundness: { type: 3 },
          boundElements: [{ type: "text" as const, id: textId }],
        };
        const textEl = {
          ...sharedProps,
          id: textId,
          type: "text" as const,
          x: rect.x + NOTE_W / 2,
          y: rect.y + NOTE_H / 2,
          width: NOTE_W - 20,
          height: NOTE_H - 20,
          text,
          fontSize: 16,
          fontFamily: 1,
          textAlign: "center" as const,
          verticalAlign: "middle" as const,
          backgroundColor: "transparent",
          strokeColor: "#1e1e1e",
          fillStyle: "solid" as const,
          strokeWidth: 0,
          roughness: 0,
          roundness: null,
          containerId: rectId,
          boundElements: null,
          originalText: text,
          autoResize: true,
        };
        const elements = [...api.getSceneElements(), rect, textEl];
        api.updateScene({ elements });
        return { id: rectId };
      } catch (e: any) {
        return { error: e?.message ?? "Failed to add sticky note" };
      }
    }

    if (name === "highlight_area") {
      try {
        const allElements = api.getSceneElements();
        if (allElements.length === 0) return { success: false };
        let minX = Infinity, minY = Infinity, maxX = -Infinity, maxY = -Infinity;
        for (const el of allElements) {
          if (el.isDeleted) continue;
          minX = Math.min(minX, el.x);
          minY = Math.min(minY, el.y);
          maxX = Math.max(maxX, el.x + el.width);
          maxY = Math.max(maxY, el.y + el.height);
        }
        if (!isFinite(minX)) return { success: false };
        const padding = 40;
        api.scrollToContent(allElements as any, { fitToViewport: true, animate: true, duration: 300 });
        const highlightId = crypto.randomUUID();
        const highlight = {
          id: highlightId,
          type: "rectangle" as const,
          x: minX - padding,
          y: minY - padding,
          width: maxX - minX + padding * 2,
          height: maxY - minY + padding * 2,
          backgroundColor: "transparent",
          strokeColor: "#6366f1",
          fillStyle: "solid" as const,
          strokeWidth: 3,
          roughness: 0,
          roundness: { type: 3 },
          opacity: 60,
          angle: 0,
          isDeleted: false,
          groupIds: [],
          boundElements: null,
          link: null,
          locked: true,
          version: 1,
          versionNonce: Math.floor(Math.random() * 1000000),
          updated: Date.now(),
          seed: Math.floor(Math.random() * 1000000),
        };
        const elements = [...api.getSceneElements(), highlight];
        api.updateScene({ elements });
        setTimeout(() => {
          try {
            const current = excalidrawAPIRef.current;
            if (current) {
              const updated = current.getSceneElements().map((el: any) =>
                el.id === highlightId ? { ...el, isDeleted: true } : el
              );
              current.updateScene({ elements: updated });
            }
          } catch {}
        }, 3000);
        return { success: true };
      } catch (e: any) {
        return { success: false };
      }
    }

    return { error: `Unknown tool: ${name}` };
  }, []);
  const voiceSession = useVani2Session({ sessionId: board.id, systemPrompt: VOICE_SYSTEM_PROMPT, runTool: runBoardTool });

  const orbState = deriveOrbState({
    transcriptionStatus: voiceTranscription.status,
    sessionStatus: voiceSession.status,
    serverStatus: voiceSession.serverStatus,
    isPlaying: voiceSession.isPlaying,
    toolRunning: voiceSession.toolRunning,
    activeToolName: voiceSession.activeToolName,
    error: voiceTranscription.error,
    sessionError: voiceSession.error,
  });

  const handleOrbTap = useCallback(() => {
    setActivePanelTab((cur) => cur === "conversation" ? null : "conversation");
  }, []);

  const handleOrbStop = useCallback(() => {
    voiceSession.sendInterrupt();
  }, [voiceSession]);

  // Turn-taking: semantic end-of-turn detection, intelligent audio ducking,
  // barge-in threshold, false-start merging, and configurable eagerness
  const BACKCHANNEL_WORDS = new Set(["yeah", "yes", "okay", "ok", "mm-hmm", "mmhmm", "mhm", "uh-huh", "right", "sure", "yep", "yup", "no", "nope", "hm", "hmm"]);
  const TRAILING_HESITATIONS = /\b(um|uh|uh+|hmm+|like|so|and|but|or|because|well)\s*$/i;
  const BARGE_IN_WORD_THRESHOLD = 3;
  const FALSE_START_MERGE_WINDOW_MS = 1500;

  type EagernessLevel = "high" | "medium" | "low";
  const [eagerness] = useState<EagernessLevel>("medium");

  const eagernessMultiplier = useMemo(() => {
    switch (eagerness) {
      case "high": return 0.6;
      case "low": return 1.5;
      default: return 1.0;
    }
  }, [eagerness]);

  const eotTimerRef = useRef<ReturnType<typeof setTimeout> | null>(null);
  const pendingTranscriptRef = useRef<string | null>(null);
  const orbTurnIdRef = useRef(0);
  const noiseCancelTimerRef = useRef<ReturnType<typeof setTimeout> | null>(null);
  const isDuckedRef = useRef(false);
  const interruptSentRef = useRef(false);
  const lastStartOfTurnRef = useRef<number>(0);

  const clearEotTimer = useCallback(() => {
    if (eotTimerRef.current) { clearTimeout(eotTimerRef.current); eotTimerRef.current = null; }
  }, []);

  const clearNoiseTimer = useCallback(() => {
    if (noiseCancelTimerRef.current) { clearTimeout(noiseCancelTimerRef.current); noiseCancelTimerRef.current = null; }
  }, []);

  const duckAudio = useCallback(() => {
    if (!isDuckedRef.current) {
      voiceSession.setVolume(0.3);
      isDuckedRef.current = true;
    }
  }, [voiceSession]);

  const restoreAudio = useCallback(() => {
    if (isDuckedRef.current) {
      voiceSession.setVolume(1.0);
      isDuckedRef.current = false;
    }
  }, [voiceSession]);

  const isBackchannel = useCallback((text: string): boolean => {
    const words = text.toLowerCase().trim().replace(/[.,!?]+$/, "").split(/\s+/);
    if (words.length > BARGE_IN_WORD_THRESHOLD) return false;
    return words.every(w => BACKCHANNEL_WORDS.has(w));
  }, []);

  const computeSemanticDebounce = useCallback((text: string, confidence: number): number => {
    const trimmed = text.trim();

    if (trimmed.endsWith("?")) return Math.round(150 * eagernessMultiplier);

    const words = trimmed.split(/\s+/);
    if (words.length === 1 && BACKCHANNEL_WORDS.has(words[0].toLowerCase().replace(/[.,!?]+$/, ""))) {
      return Math.round(100 * eagernessMultiplier);
    }

    if (TRAILING_HESITATIONS.test(trimmed)) {
      return Math.round(800 * eagernessMultiplier);
    }

    if (confidence > 0.9) return Math.round(200 * eagernessMultiplier);
    if (confidence > 0.75) return Math.round(350 * eagernessMultiplier);
    return Math.round(500 * eagernessMultiplier);
  }, [eagernessMultiplier]);

  const commitTranscript = useCallback(() => {
    eotTimerRef.current = null;
    const text = pendingTranscriptRef.current;
    pendingTranscriptRef.current = null;
    if (text) {
      restoreAudio();
      clearNoiseTimer();
      if (!interruptSentRef.current && (voiceSession.llmText || voiceSession.isPlaying)) {
        voiceSession.sendInterrupt();
      }
      interruptSentRef.current = false;
      voiceSession.sendTranscriptFinal(text, String(orbTurnIdRef.current));
    }
  }, [voiceSession, restoreAudio, clearNoiseTimer]);

  useEffect(() => {
    const ev = voiceTranscription.lastEvent;
    if (!ev) return;

    if (ev.type === "StartOfTurn") {
      const now = Date.now();
      const timeSinceLast = now - lastStartOfTurnRef.current;
      lastStartOfTurnRef.current = now;

      if (timeSinceLast < FALSE_START_MERGE_WINDOW_MS && pendingTranscriptRef.current) {
        clearEotTimer();
      } else {
        orbTurnIdRef.current += 1;
        clearEotTimer();
        pendingTranscriptRef.current = null;
        interruptSentRef.current = false;
      }

      if (voiceSession.isPlaying || voiceSession.llmText) {
        duckAudio();
      }
      clearNoiseTimer();
      noiseCancelTimerRef.current = setTimeout(() => {
        restoreAudio();
        noiseCancelTimerRef.current = null;
      }, 3000);
    }

    if (ev.type === "TurnResumed") {
      clearEotTimer();
      clearNoiseTimer();
      noiseCancelTimerRef.current = setTimeout(() => {
        restoreAudio();
        noiseCancelTimerRef.current = null;
      }, 3000);
    }

    if (ev.type === "EagerEndOfTurn") {
      const confidence = ev.payload.end_of_turn_confidence ?? 0;
      if (confidence > 0.7 && ev.payload.transcript?.trim()) {
        const t = ev.payload.transcript.trim();
        pendingTranscriptRef.current = pendingTranscriptRef.current ? `${pendingTranscriptRef.current} ${t}` : t;

        const currentText = pendingTranscriptRef.current;
        if (isDuckedRef.current && !interruptSentRef.current && !isBackchannel(currentText)) {
          voiceSession.sendInterrupt();
          interruptSentRef.current = true;
        }

        clearEotTimer();
        if (confidence > 0.85) {
          const debounceMs = computeSemanticDebounce(currentText, confidence);
          eotTimerRef.current = setTimeout(commitTranscript, debounceMs);
        }
      }
    }

    if (ev.type === "EndOfTurn" && ev.payload.transcript) {
      const t = ev.payload.transcript.trim();
      if (!t) return;
      clearNoiseTimer();
      const merged = pendingTranscriptRef.current ? `${pendingTranscriptRef.current} ${t}` : t;
      pendingTranscriptRef.current = merged;

      if (isDuckedRef.current && !interruptSentRef.current && !isBackchannel(merged)) {
        voiceSession.sendInterrupt();
        interruptSentRef.current = true;
      }

      if (isBackchannel(merged) && isDuckedRef.current) {
        pendingTranscriptRef.current = null;
        restoreAudio();
        interruptSentRef.current = false;
        return;
      }

      clearEotTimer();
      const confidence = ev.payload.end_of_turn_confidence ?? 0.5;
      const debounceMs = computeSemanticDebounce(merged, confidence);
      eotTimerRef.current = setTimeout(commitTranscript, debounceMs);
    }
  }, [voiceTranscription.lastEvent, voiceSession, clearEotTimer, clearNoiseTimer, duckAudio, restoreAudio, commitTranscript, isBackchannel, computeSemanticDebounce]);

  useEffect(() => {
    return () => {
      if (eotTimerRef.current) clearTimeout(eotTimerRef.current);
      if (noiseCancelTimerRef.current) clearTimeout(noiseCancelTimerRef.current);
    };
  }, []);

  // Track board access for the user's personal index
  const trackBoardAccess = useTrackBoardAccess();

  // Track board access when component mounts (user opens the board)
  useEffect(() => {
    if (board.id && userId) {
      trackBoardAccess.mutate(board.id);
    }
  }, [board.id, userId]); // Only run once when board/user is first available

  // Recording State
  const [isRecording, setIsRecording] = useState(false);
  const [recordingSessionId, setRecordingSessionId] = useState<string | null>(null);
  const [recordingVideoId, setRecordingVideoId] = useState<string | null>(null); // VideosDO video ID
  const [recordingStartTime, setRecordingStartTime] = useState<number | null>(null);
  const [recordingDuration, setRecordingDuration] = useState(0);
  const [isMuted, setIsMuted] = useState(false);
  const [isVideoEnabled, setIsVideoEnabled] = useState(false);

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
        // Update video status in VideosDO - the backend handles this via monorail finalization
        setUploadPublishId(null); // Stop polling
        toast.success("Recording uploaded to YouTube!");
        queryClient.invalidateQueries({ queryKey: ['videos'] });
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
      // 1. Create Monorail Session
      const res = await fetch('/api/v1/monorail.createSession', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ sessionId: undefined })
      });
      if (!res.ok) throw new Error("Failed to create session");
      const responseData = await res.json() as any;
      const session = responseData.result.data;

      setRecordingSessionId(session.id);

      // 2. Create video record in VideosDO with boardId linkage
      const newVideoId = crypto.randomUUID();
      console.log('[Recording] Creating video in VideosDO:', {
        videoId: newVideoId,
        boardId: board.id,
        sessionId: session.id
      });

      try {
        await trpcClient.videos.create.mutate({
          id: newVideoId,
          title: `Recording ${new Date().toLocaleString()}`,
          sessionId: session.id,
          boardId: board.id, // Link to current board
          status: 'RECORDED'
        });
        setRecordingVideoId(newVideoId);
        console.log('[Recording] Successfully created video in VideosDO');

        // Invalidate videos list to show the new (in-progress) recording
        await queryClient.invalidateQueries({ queryKey: ['videos'] });
      } catch (createError) {
        console.error('[Recording] Failed to create video in VideosDO:', createError);
        toast.error("Recording started but metadata not saved");
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
      const videoId = recordingVideoId;

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
      setRecordingVideoId(null);

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

          // Invalidate videos query to refresh the list
          await queryClient.invalidateQueries({ queryKey: ['videos'] });

          toast.success("Recording saved! Processing...");
        } catch (saveError) {
          console.error('[Recording] Failed to finalize recording:', saveError);
          toast.error("Recording completed but failed to finalize");
        }


      }
    } catch (e) {
      console.error("[Recording] Stop error:", e);
      toast.error("Error stopping recording");
    }
  };


  // Use the library for syncing
  // Use the library for syncing
  // Use the library for syncing
  const { handleChange, onPointerUpdate, connectionStatus, reconnect } = useExcalidrawLiveSync({
    excalidrawAPI: excalidrawAPI, // FIX: Pass state, not ref!!
    boardId: board.id,
    userId: userId || 'anonymous',
    userInfo: {
      username: userProfile.username,
      avatarUrl: userProfile.avatarUrl,
      color: userProfile.color,
    },
    baseUrl: typeof window !== 'undefined' ? window.location.origin : undefined,
  });

  useRemoteFileHandler({ excalidrawAPI, boardId: board.id });

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
  const [isOffline, setIsOffline] = useState(!navigator.onLine);

  useEffect(() => {
    const goOffline = () => setIsOffline(true);
    const goOnline = () => setIsOffline(false);
    window.addEventListener('offline', goOffline);
    window.addEventListener('online', goOnline);
    return () => {
      window.removeEventListener('offline', goOffline);
      window.removeEventListener('online', goOnline);
    };
  }, []);

  const togglePanel = (tab: 'share' | 'conversation') => {
    setActivePanelTab(current => current === tab ? null : tab);
  };

  return (
    <div className="flex h-full w-full overflow-hidden relative bg-background flex-col pb-[env(safe-area-inset-bottom)]">
        {/* Offline Banner */}
        {isOffline && (
          <div className="shrink-0 flex items-center justify-center gap-2 px-4 py-2 bg-amber-50 dark:bg-amber-950/40 border-b border-amber-200 dark:border-amber-800 text-amber-800 dark:text-amber-200 text-sm" role="alert">
            <WifiOff className="w-4 h-4" />
            <span>You're offline. Changes will sync when you reconnect.</span>
          </div>
        )}

        <TopBar
          board={board}
          menuItems={menuItems || []}
          onToggleShare={() => togglePanel('share')}
          onToggleChat={() => togglePanel('conversation')}
          isShareOpen={activePanelTab === 'share'}
          isChatOpen={activePanelTab === 'conversation'}
          onBack={onBack || (() => { })}
          onTitleChange={onTitleChange || (() => { })}

          onViewRecordings={() => navigate(`/app/videos?boardId=${board.id}`)}

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
          connectionStatus={connectionStatus}
          onReconnect={reconnect}
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
              onChange={(elements, appState, files) => {
                handleChange(elements, appState, files);
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

            {/* Voice Orb (floating, bottom-right) */}
            {!isRecording && (
              <div className="absolute bottom-5 right-5 z-50">
                <VoiceOrb
                  state={orbState}
                  onTap={handleOrbTap}
                  onStop={handleOrbStop}
                  error={voiceTranscription.error || voiceSession.error}
                />
              </div>
            )}
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
              excalidrawAPI={excalidrawAPI}
              voiceTranscription={voiceTranscription}
              voiceSession={voiceSession}
            />
          </div>
        </div>

      </div>
  );
}

export default BoardEditor;

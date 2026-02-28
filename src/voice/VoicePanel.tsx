import { Mic, MicOff, Circle, MessageSquare, Loader2, Wrench } from "lucide-react";

const FLUX_EVENT_LABELS: Record<string, { label: string; color: string }> = {
  StartOfTurn: { label: "Turn started", color: "bg-emerald-500/20 text-emerald-400 border-emerald-600/50" },
  Update: { label: "Listening", color: "bg-sky-500/20 text-sky-400 border-sky-600/50" },
  EagerEndOfTurn: { label: "Eager EOT", color: "bg-amber-500/20 text-amber-400 border-amber-600/50" },
  TurnResumed: { label: "Turn resumed", color: "bg-violet-500/20 text-violet-400 border-violet-600/50" },
  EndOfTurn: { label: "Turn ended", color: "bg-rose-500/20 text-rose-400 border-rose-600/50" },
};

export interface VoicePanelProps {
  boardId: string;
  excalidrawAPI?: any | null;
  className?: string;
  transcription?: {
    status: string;
    error: string | null;
    liveTranscript: string;
    transcriptHistory: string[];
    lastEvent: any;
    fluxState: { event?: string };
    connect: () => void;
    disconnect: () => void;
  };
  session?: {
    status: string;
    error: string | null;
    serverStatus: string | null;
    llmText: string;
    llmError: string | null;
    assistantHistory: string[];
    isPlaying: boolean;
    toolRunning: boolean;
    toolCallHistory: Array<{ id: string; name: string; result?: unknown; imageDataUrl?: string }>;
    connect: () => void;
    disconnect: () => void;
  };
}

export function VoicePanel({ className = "", transcription, session }: VoicePanelProps) {
  const status = transcription?.status ?? "disconnected";
  const error = transcription?.error ?? null;
  const liveTranscript = transcription?.liveTranscript ?? "";
  const transcriptHistory = transcription?.transcriptHistory ?? [];
  const lastEvent = transcription?.lastEvent ?? null;
  const fluxState = transcription?.fluxState ?? {};

  const sessionStatus = session?.status ?? "disconnected";
  const sessionError = session?.error ?? null;
  const serverStatus = session?.serverStatus ?? null;
  const llmText = session?.llmText ?? "";
  const llmError = session?.llmError ?? null;
  const assistantHistory = session?.assistantHistory ?? [];
  const isPlaying = session?.isPlaying ?? false;
  const toolRunning = session?.toolRunning ?? false;
  const toolCallHistory = session?.toolCallHistory ?? [];

  const isTranscribing = status === "connected";
  const isFluxConnecting = status === "connecting";
  const isSessionConnecting = sessionStatus === "connecting";
  const isConnecting = isFluxConnecting || isSessionConnecting;
  const isSessionConnected = sessionStatus === "connected";
  const isActive = isTranscribing || isConnecting;

  const start = () => {
    // #region agent log
    fetch('http://127.0.0.1:7452/ingest/76d149d6-cce2-4bf2-a818-7dc29428d885',{method:'POST',headers:{'Content-Type':'application/json','X-Debug-Session-Id':'400d2f'},body:JSON.stringify({sessionId:'400d2f',location:'VoicePanel.tsx:start',message:'Start voice clicked',data:{hasSession:!!session,hasTranscription:!!transcription,sessionConnect:typeof session?.connect,transcriptionConnect:typeof transcription?.connect},timestamp:Date.now()})}).catch(()=>{});
    // #endregion
    session?.connect();
    transcription?.connect();
  };

  const stop = () => {
    // #region agent log
    fetch('http://127.0.0.1:7452/ingest/76d149d6-cce2-4bf2-a818-7dc29428d885',{method:'POST',headers:{'Content-Type':'application/json','X-Debug-Session-Id':'400d2f'},body:JSON.stringify({sessionId:'400d2f',location:'VoicePanel.tsx:stop',message:'Stop voice clicked',data:{},timestamp:Date.now()})}).catch(()=>{});
    // #endregion
    transcription?.disconnect();
    session?.disconnect();
  };

  return (
    <div className={`flex flex-col h-full bg-background ${className}`}>
      <div className="px-4 py-3 border-b bg-muted/20">
        <h2 className="text-sm font-semibold tracking-tight">Voice Assistant</h2>
      </div>

      <div className="flex-1 overflow-y-auto p-4 space-y-4">
        {/* Start / Stop / Connecting */}
        {!isActive && (
          <button
            type="button"
            onClick={start}
            className="w-full min-h-[44px] py-3 rounded-xl bg-primary text-primary-foreground font-medium transition-colors flex items-center justify-center gap-2"
          >
            <Mic className="w-5 h-5" />
            Start voice
          </button>
        )}

        {isConnecting && (
          <div className="py-3 rounded-xl bg-muted/50 border flex flex-col items-center justify-center gap-2">
            <div className="flex items-center gap-2">
              <Loader2 className="w-4 h-4 animate-spin" />
              <span className="text-sm text-muted-foreground">Connecting...</span>
            </div>
            <div className="flex gap-4 text-xs text-muted-foreground">
              {isFluxConnecting && <span>Flux (STT)</span>}
              {isSessionConnecting && <span>Session (LLM/TTS)</span>}
            </div>
          </div>
        )}

        {isTranscribing && (
          <>
            <div className="flex items-center justify-between gap-2 py-2 px-3 rounded-xl bg-muted/50 border">
              <div className="flex items-center gap-3 flex-wrap">
                <div className="flex items-center gap-1.5">
                  <div className="w-2.5 h-2.5 rounded-full bg-emerald-500 animate-pulse" />
                  <span className="text-xs text-muted-foreground">Flux</span>
                </div>
                {isSessionConnected && (
                  <div className="flex items-center gap-1.5 text-muted-foreground">
                    <span className="w-1.5 h-1.5 rounded-full bg-sky-500" />
                    <span className="text-xs">Session</span>
                  </div>
                )}
                {serverStatus === "thinking" && (
                  <div className="flex items-center gap-1.5 text-sky-600 dark:text-sky-400">
                    <span className="w-1.5 h-1.5 rounded-full bg-sky-500 animate-pulse" />
                    <span className="text-xs">Thinking...</span>
                  </div>
                )}
                {serverStatus === "synthesizing" && (
                  <div className="flex items-center gap-1.5 text-violet-600 dark:text-violet-400">
                    <span className="w-1.5 h-1.5 rounded-full bg-violet-500 animate-pulse" />
                    <span className="text-xs">Synthesizing...</span>
                  </div>
                )}
                {toolRunning && (
                  <div className="flex items-center gap-1.5 text-amber-600 dark:text-amber-400">
                    <span className="w-1.5 h-1.5 rounded-full bg-amber-500 animate-pulse" />
                    <span className="text-xs">Looking at board...</span>
                  </div>
                )}
                {isPlaying && (
                  <div className="flex items-center gap-1.5 text-primary">
                    <span className="w-1.5 h-1.5 rounded-full bg-primary animate-pulse" />
                    <span className="text-xs">Playing</span>
                  </div>
                )}
              </div>
              <button
                type="button"
                onClick={stop}
                className="flex items-center gap-1.5 min-h-[44px] min-w-[44px] py-1.5 px-2.5 rounded-lg bg-destructive/10 border border-destructive/30 text-destructive hover:bg-destructive/20 text-xs font-medium"
              >
                <MicOff className="w-3.5 h-3.5" />
                Stop
              </button>
            </div>

            {fluxState.event && (
              <div className="flex flex-wrap items-center gap-2">
                <span
                  className={`inline-flex items-center gap-1.5 px-2.5 py-1 rounded-md border text-xs ${
                    FLUX_EVENT_LABELS[fluxState.event]?.color ?? "bg-muted text-muted-foreground border-border"
                  }`}
                >
                  <Circle className="w-1.5 h-1.5 fill-current" />
                  {FLUX_EVENT_LABELS[fluxState.event]?.label ?? fluxState.event}
                </span>
              </div>
            )}
          </>
        )}

        {(error || sessionError) && (
          <div className="px-3 py-2 rounded-lg bg-destructive/10 border border-destructive/30" role="alert">
            <p className="text-xs font-medium text-destructive">Connection error</p>
            <p className="text-xs text-destructive/90 mt-1">{error || sessionError}</p>
          </div>
        )}

        {llmError && (
          <div className="px-3 py-2 rounded-lg bg-destructive/10 border border-destructive/30" role="alert">
            <p className="text-xs font-medium text-destructive">LLM error</p>
            <p className="text-xs text-destructive/90 mt-1">{llmError}</p>
          </div>
        )}

        {toolCallHistory.length > 0 && (
          <div>
            <label className="block text-xs font-medium text-muted-foreground uppercase tracking-wider mb-1.5 flex items-center gap-1.5">
              <Wrench className="w-3.5 h-3.5" />
              Tool calls (what the AI saw)
            </label>
            <div className="max-h-64 w-full rounded-xl bg-muted/30 border overflow-y-auto overflow-x-hidden flex flex-col min-w-0 space-y-2 p-2">
              {[...toolCallHistory].reverse().map((entry) => (
                <div
                  key={entry.id}
                  className="rounded-lg border bg-background/80 p-2 flex flex-col gap-2 min-w-0"
                >
                  <div className="flex items-center gap-2 text-xs">
                    <span className="font-medium text-foreground">{entry.name}</span>
                    {entry.result && typeof entry.result === "object" && "error" in (entry.result as object) && (
                      <span className="text-destructive">error</span>
                    )}
                  </div>
                  {entry.imageDataUrl && (
                    <div className="flex flex-col gap-1">
                      <span className="text-xs text-muted-foreground">Board snapshot sent to model:</span>
                      <img
                        src={entry.imageDataUrl}
                        alt="Board snapshot"
                        className="max-h-32 w-auto max-w-full rounded border object-contain bg-muted/50"
                      />
                    </div>
                  )}
                </div>
              ))}
            </div>
          </div>
        )}

        {(llmText || assistantHistory.length > 0) && (
          <div>
            <label className="block text-xs font-medium text-muted-foreground uppercase tracking-wider mb-1.5 flex items-center gap-1.5">
              <MessageSquare className="w-3.5 h-3.5" />
              Assistant
            </label>
            <div className="max-h-48 w-full rounded-xl bg-muted/30 border overflow-y-auto overflow-x-hidden flex flex-col min-w-0">
              {llmText && (
                <div className="px-3 py-2.5 text-sm text-foreground whitespace-pre-wrap break-words border-b shrink-0">
                  {llmText}
                  <span className="animate-pulse">|</span>
                </div>
              )}
              <div className="flex flex-col min-h-0">
                {assistantHistory.map((text, i) => (
                  <div
                    key={i}
                    className="px-3 py-2.5 text-sm text-muted-foreground whitespace-pre-wrap break-words border-b last:border-b-0"
                  >
                    {text}
                  </div>
                ))}
              </div>
            </div>
          </div>
        )}

        {(isTranscribing || transcriptHistory.length > 0) && (
          <div>
            <label className="block text-xs font-medium text-muted-foreground uppercase tracking-wider mb-1.5">
              Transcripts
            </label>
            <div className="max-h-48 w-full rounded-xl bg-muted/30 border overflow-y-auto overflow-x-hidden flex flex-col min-w-0">
              {(liveTranscript || (lastEvent && isTranscribing ? `[${lastEvent.type}]` : "")) && (
                <div className="px-3 py-2.5 text-sm text-amber-600 dark:text-amber-400 whitespace-pre-wrap break-words border-b shrink-0">
                  {liveTranscript || (lastEvent ? `[${lastEvent.type}]` : "")}
                </div>
              )}
              <div className="flex flex-col min-h-0">
                {transcriptHistory.map((text, i) => (
                  <div
                    key={i}
                    className="px-3 py-2.5 text-sm text-muted-foreground whitespace-pre-wrap break-words border-b last:border-b-0"
                  >
                    {text}
                  </div>
                ))}
              </div>
            </div>
          </div>
        )}
      </div>
    </div>
  );
}

import { useMemo } from "react";
import { Mic, AlertCircle, Loader2, Eye, AudioLines, Brain, Wrench } from "lucide-react";

export type OrbState =
  | "idle"
  | "connecting"
  | "listening"
  | "thinking"
  | "readingBoard"
  | "speaking"
  | "toolRunning"
  | "interrupted"
  | "error";

interface VoiceOrbProps {
  state: OrbState;
  onTap: () => void;
  error?: string | null;
  className?: string;
}

const STATE_CONFIG: Record<OrbState, { label: string; ring: string; bg: string; pulse?: boolean; spin?: boolean }> = {
  idle:         { label: "",              ring: "border-muted-foreground/30", bg: "bg-muted/60" },
  connecting:   { label: "Connecting…",   ring: "border-sky-400/60",         bg: "bg-sky-500/10",    pulse: true },
  listening:    { label: "Listening…",    ring: "border-emerald-400/70",     bg: "bg-emerald-500/10", pulse: true },
  thinking:     { label: "Thinking…",     ring: "border-blue-400/70",        bg: "bg-blue-500/10",    spin: true },
  readingBoard: { label: "Reading board…",ring: "border-amber-400/70",       bg: "bg-amber-500/10",   spin: true },
  speaking:     { label: "Speaking…",     ring: "border-violet-400/70",      bg: "bg-violet-500/10",  pulse: true },
  toolRunning:  { label: "Working…",      ring: "border-amber-400/60",       bg: "bg-amber-500/10",   pulse: true },
  interrupted:  { label: "",              ring: "border-rose-400/60",        bg: "bg-rose-500/10" },
  error:        { label: "Error",         ring: "border-destructive/60",     bg: "bg-destructive/10" },
};

const ICON_COLORS: Record<OrbState, string> = {
  idle:         "text-muted-foreground",
  connecting:   "text-sky-500",
  listening:    "text-emerald-500",
  thinking:     "text-blue-500",
  readingBoard: "text-amber-500",
  speaking:     "text-violet-500",
  toolRunning:  "text-amber-500",
  interrupted:  "text-rose-500",
  error:        "text-destructive",
};

function OrbIcon({ state }: { state: OrbState }) {
  const color = ICON_COLORS[state];
  const cls = `w-5 h-5 ${color}`;
  switch (state) {
    case "error": return <AlertCircle className={`w-6 h-6 ${color}`} />;
    case "connecting": return <Loader2 className={`${cls} animate-spin`} />;
    case "thinking": return <Brain className={cls} />;
    case "readingBoard": return <Eye className={cls} />;
    case "speaking": return <AudioLines className={cls} />;
    case "toolRunning": return <Wrench className={cls} />;
    case "listening": return <Mic className={`${cls} animate-pulse`} />;
    default: return <Mic className={cls} />;
  }
}

export function deriveOrbState(opts: {
  transcriptionStatus: string;
  sessionStatus: string;
  serverStatus: string | null;
  isPlaying: boolean;
  toolRunning: boolean;
  activeToolName: string | null;
  error: string | null;
  sessionError: string | null;
}): OrbState {
  const { transcriptionStatus, sessionStatus, serverStatus, isPlaying, toolRunning, activeToolName, error, sessionError } = opts;
  if (error || sessionError) return "error";
  if (transcriptionStatus === "connecting" || sessionStatus === "connecting") return "connecting";
  if (toolRunning && activeToolName === "read_board") return "readingBoard";
  if (toolRunning) return "toolRunning";
  if (serverStatus === "thinking") return "thinking";
  if (serverStatus === "synthesizing" || isPlaying) return "speaking";
  if (transcriptionStatus === "connected") return "listening";
  return "idle";
}

export function VoiceOrb({ state, onTap, error, className = "" }: VoiceOrbProps) {
  const config = STATE_CONFIG[state];

  const ringAnimation = useMemo(() => {
    if (config.spin) return "animate-[voice-orb-spin_2s_linear_infinite]";
    if (config.pulse) return "animate-[voice-orb-pulse_1.5s_ease-in-out_infinite]";
    if (state === "interrupted") return "animate-[voice-orb-shake_0.3s_ease-in-out]";
    return "";
  }, [config.spin, config.pulse, state]);

  return (
    <div className={`flex flex-col items-center gap-1.5 ${className}`}>
      <button
        type="button"
        onClick={onTap}
        className={`
          relative w-12 h-12 rounded-full flex items-center justify-center
          transition-all duration-300 ease-out cursor-pointer
          border-2 ${config.ring} ${config.bg}
          hover:scale-110 active:scale-95
          focus:outline-none focus-visible:ring-2 focus-visible:ring-ring focus-visible:ring-offset-2
          shadow-lg backdrop-blur-sm
          ${ringAnimation}
        `}
        aria-label="Voice assistant"
        title={error ?? config.label ?? "Voice assistant"}
      >
        <OrbIcon state={state} />

        {(state === "speaking" || state === "listening") && (
          <>
            <span className={`absolute inset-0 rounded-full border ${config.ring} animate-[voice-orb-ripple_2s_ease-out_infinite] opacity-0`} />
            <span className={`absolute inset-0 rounded-full border ${config.ring} animate-[voice-orb-ripple_2s_ease-out_infinite_0.6s] opacity-0`} />
          </>
        )}

        {(state === "thinking" || state === "readingBoard") && (
          <span className="absolute inset-[-3px] rounded-full border-2 border-transparent border-t-current animate-[voice-orb-spin_1s_linear_infinite]"
            style={{ color: state === "readingBoard" ? "var(--color-amber-400)" : "var(--color-blue-400)" }}
          />
        )}
      </button>

      {config.label && state !== "idle" && (
        <span className="text-[10px] text-muted-foreground font-medium tracking-wide select-none animate-in fade-in duration-200">
          {config.label}
        </span>
      )}
    </div>
  );
}

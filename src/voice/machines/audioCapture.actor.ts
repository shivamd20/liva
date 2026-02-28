/**
 * AudioCaptureActor – manages microphone capture pipeline for Flux STT.
 *
 * Uses fromCallback because the audio data path (worklet -> WS) is too hot
 * for XState event dispatch (~62.5 chunks/sec at 16kHz). This actor manages
 * lifecycle only; raw PCM flows directly from the worklet to the Flux WS.
 *
 * Lifecycle: start -> getUserMedia -> AudioContext(16kHz) -> AudioWorklet -> ready
 *            stop  -> disconnect nodes -> stop tracks -> close context
 */
import { fromCallback, type AnyActorRef } from "xstate";

// ---------------------------------------------------------------------------
// Constants
// ---------------------------------------------------------------------------

const FLUX_SAMPLE_RATE = 16_000;
const BACKPRESSURE_BYTES = 128 * 1024;

// ---------------------------------------------------------------------------
// Input
// ---------------------------------------------------------------------------

export interface AudioCaptureInput {
  getFluxWs: () => WebSocket | null;
}

// ---------------------------------------------------------------------------
// Events this actor sends to parent
// ---------------------------------------------------------------------------

export type AudioCaptureParentEvent =
  | { type: "CAPTURE_READY" }
  | { type: "CAPTURE_ERROR"; error: string }
  | { type: "CAPTURE_STOPPED" };

// ---------------------------------------------------------------------------
// Events this actor receives from parent
// ---------------------------------------------------------------------------

type AudioCaptureReceiveEvent =
  | { type: "START" }
  | { type: "STOP" };

// ---------------------------------------------------------------------------
// Actor
// ---------------------------------------------------------------------------

export const audioCaptureActor = fromCallback<
  AudioCaptureReceiveEvent,
  AudioCaptureInput
>(({ sendBack, receive, input }) => {
  let stream: MediaStream | null = null;
  let audioContext: AudioContext | null = null;
  let workletNode: AudioWorkletNode | null = null;
  let sourceNode: MediaStreamAudioSourceNode | null = null;
  let lastSendTime = 0;

  function cleanup() {
    stream?.getTracks().forEach((t) => t.stop());
    stream = null;
    workletNode?.disconnect();
    workletNode = null;
    sourceNode?.disconnect();
    sourceNode = null;
    if (audioContext && audioContext.state !== "closed") {
      try { audioContext.close(); } catch { /* noop */ }
    }
    audioContext = null;
  }

  async function start() {
    try {
      stream = await navigator.mediaDevices.getUserMedia({ audio: true });

      audioContext = new AudioContext({ sampleRate: FLUX_SAMPLE_RATE });
      if (audioContext.state === "suspended") await audioContext.resume();

      const workletUrl = new URL("../flux-capture-worklet.js", import.meta.url).href;
      await audioContext.audioWorklet.addModule(workletUrl);
      workletNode = new AudioWorkletNode(audioContext, "flux-capture-processor");

      sourceNode = audioContext.createMediaStreamSource(stream);

      workletNode.port.onmessage = (event: MessageEvent) => {
        const { chunk } = event.data as { chunk: ArrayBuffer };
        if (!chunk) return;
        const ws = input.getFluxWs();
        if (!ws || ws.readyState !== WebSocket.OPEN) return;
        if (ws.bufferedAmount > BACKPRESSURE_BYTES) return;
        try {
          ws.send(chunk);
          lastSendTime = Date.now();
        } catch { /* noop */ }
      };

      sourceNode.connect(workletNode);
      const silence = audioContext.createGain();
      silence.gain.value = 0;
      workletNode.connect(silence);
      silence.connect(audioContext.destination);

      sendBack({ type: "CAPTURE_READY" });
    } catch (err) {
      cleanup();
      sendBack({
        type: "CAPTURE_ERROR",
        error: err instanceof Error ? err.message : String(err),
      });
    }
  }

  receive((event) => {
    if (event.type === "START") {
      start();
    }
    if (event.type === "STOP") {
      cleanup();
      sendBack({ type: "CAPTURE_STOPPED" });
    }
  });

  return () => {
    cleanup();
  };
});

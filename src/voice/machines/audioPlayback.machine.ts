/**
 * AudioPlaybackActor – manages TTS audio playback queue.
 *
 * States: idle -> playing -> idle (loop)
 * Handles: decode incoming ArrayBuffers, queue management (max 8),
 * sequential playback, volume ducking, max speaking duration (45s),
 * and interrupt/stop.
 */
import { setup, assign, type AnyActorRef } from "xstate";

// ---------------------------------------------------------------------------
// Constants
// ---------------------------------------------------------------------------

const MAX_PLAYBACK_QUEUE = 8;
const MAX_SPEAKING_DURATION_MS = 45_000;

// ---------------------------------------------------------------------------
// Context
// ---------------------------------------------------------------------------

interface PlaybackContext {
  queue: AudioBuffer[];
  audioContext: AudioContext | null;
  gainNode: GainNode | null;
  currentSource: AudioBufferSourceNode | null;
  isPlaying: boolean;
  speakingStartedAt: number | null;
}

// ---------------------------------------------------------------------------
// Events
// ---------------------------------------------------------------------------

type PlaybackEvent =
  | { type: "ENQUEUE_AUDIO"; buffer: ArrayBuffer }
  | { type: "AUDIO_DECODED"; audioBuffer: AudioBuffer }
  | { type: "AUDIO_ENDED" }
  | { type: "STOP_PLAYBACK" }
  | { type: "SET_VOLUME"; value: number }
  | { type: "SPEAKING_TIMEOUT" }
  | { type: "INIT_CONTEXT" }
  | { type: "DECODE_ERROR"; error: string };

// ---------------------------------------------------------------------------
// Machine
// ---------------------------------------------------------------------------

export const audioPlaybackMachine = setup({
  types: {
    context: {} as PlaybackContext,
    events: {} as PlaybackEvent,
  },
  guards: {
    hasMoreBuffers: ({ context }) => context.queue.length > 1,
    isQueueFull: ({ context }) => context.queue.length >= MAX_PLAYBACK_QUEUE,
    hasAudioContext: ({ context }) => context.audioContext !== null,
  },
  delays: {
    speakingTimeout: MAX_SPEAKING_DURATION_MS,
  },
}).createMachine({
  id: "audioPlayback",
  context: {
    queue: [],
    audioContext: null,
    gainNode: null,
    currentSource: null,
    isPlaying: false,
    speakingStartedAt: null,
  },

  initial: "idle",

  on: {
    INIT_CONTEXT: {
      guard: ({ context }) => context.audioContext === null,
      actions: assign(() => {
        const ctx = new AudioContext();
        const gain = ctx.createGain();
        gain.connect(ctx.destination);
        return { audioContext: ctx, gainNode: gain };
      }),
    },

    DECODE_ERROR: {
      actions: ({ event, self }) => {
        const parent = (self as AnyActorRef)._parent;
        if (parent) parent.send({ type: "ERROR", error: event.error, source: "audio_decode" });
      },
    },

    SET_VOLUME: {
      actions: ({ context, event }) => {
        if (context.gainNode) {
          const val = Math.max(0, Math.min(1, event.value));
          context.gainNode.gain.setValueAtTime(val, context.gainNode.context.currentTime);
        }
      },
    },

    STOP_PLAYBACK: {
      target: ".idle",
      actions: [
        ({ context }) => {
          if (context.currentSource) {
            try { context.currentSource.stop(); } catch { /* noop */ }
          }
        },
        assign({
          queue: [],
          currentSource: null,
          isPlaying: false,
          speakingStartedAt: null,
        }),
        ({ self }) => {
          const parent = (self as AnyActorRef)._parent;
          if (parent) parent.send({ type: "PLAYBACK_STATE_CHANGED", isPlaying: false });
        },
      ],
    },
  },

  states: {
    idle: {
      entry: [
        assign({ isPlaying: false, speakingStartedAt: null, currentSource: null }),
        ({ self }) => {
          const parent = (self as AnyActorRef)._parent;
          if (parent) parent.send({ type: "PLAYBACK_STATE_CHANGED", isPlaying: false });
        },
      ],

      on: {
        ENQUEUE_AUDIO: {
          actions: ({ context, event, self }) => {
            const ctx = context.audioContext;
            if (!ctx) return;
            ctx
              .decodeAudioData(event.buffer.slice(0))
              .then((audioBuffer: AudioBuffer) => {
                (self as AnyActorRef).send({ type: "AUDIO_DECODED", audioBuffer });
              })
              .catch((err: Error) => {
                (self as AnyActorRef).send({ type: "DECODE_ERROR", error: err.message });
              });
          },
        },
        AUDIO_DECODED: [
          {
            guard: "isQueueFull",
          },
          {
            target: "playing",
            actions: assign({
              queue: ({ context, event }) => [...context.queue, event.audioBuffer],
            }),
          },
        ],
      },
    },

    playing: {
      entry: [
        assign({
          isPlaying: true,
          speakingStartedAt: ({ context }) => context.speakingStartedAt ?? Date.now(),
        }),
        ({ self }) => {
          const parent = (self as AnyActorRef)._parent;
          if (parent) parent.send({ type: "PLAYBACK_STATE_CHANGED", isPlaying: true });
        },
      ],

      after: {
        speakingTimeout: {
          target: "idle",
          actions: [
            ({ context }) => {
              if (context.currentSource) {
                try { context.currentSource.stop(); } catch { /* noop */ }
              }
            },
            assign({ queue: [], currentSource: null }),
          ],
        },
      },

      initial: "draining",

      states: {
        draining: {
          entry: ({ context, self }) => {
            const ctx = context.audioContext;
            const gain = context.gainNode;
            const queue = context.queue;
            if (!ctx || !gain || queue.length === 0) return;

            if (ctx.state === "suspended") {
              ctx.resume();
            }

            const buffer = queue[0];
            const source = ctx.createBufferSource();
            source.buffer = buffer;
            source.connect(gain);
            source.onended = () => {
              (self as AnyActorRef).send({ type: "AUDIO_ENDED" });
            };
            source.start(0);
          },

          on: {
            AUDIO_ENDED: [
              {
                guard: "hasMoreBuffers",
                target: "draining",
                reenter: true,
                actions: assign({
                  currentSource: null,
                  queue: ({ context }) => context.queue.slice(1),
                }),
              },
              {
                target: "#audioPlayback.idle",
              },
            ],
          },
        },
      },

      on: {
        ENQUEUE_AUDIO: {
          actions: ({ context, event, self }) => {
            const ctx = context.audioContext;
            if (!ctx) return;
            ctx
              .decodeAudioData(event.buffer.slice(0))
              .then((audioBuffer: AudioBuffer) => {
                (self as AnyActorRef).send({ type: "AUDIO_DECODED", audioBuffer });
              })
              .catch((err: Error) => {
                (self as AnyActorRef).send({ type: "DECODE_ERROR", error: err.message });
              });
          },
        },
        AUDIO_DECODED: {
          guard: ({ context }) => context.queue.length < MAX_PLAYBACK_QUEUE,
          actions: assign({
            queue: ({ context, event }) => [...context.queue, event.audioBuffer],
          }),
        },
      },
    },
  },
});

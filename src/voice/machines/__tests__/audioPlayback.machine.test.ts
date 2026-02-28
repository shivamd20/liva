import { describe, it, expect, vi, beforeEach, afterEach } from "vitest";
import { createActor } from "xstate";
import { audioPlaybackMachine } from "../audioPlayback.machine";

function mockAudioBuffer(): AudioBuffer {
  return {
    length: 1024,
    duration: 0.5,
    sampleRate: 44100,
    numberOfChannels: 1,
    getChannelData: vi.fn(() => new Float32Array(1024)),
    copyFromChannel: vi.fn(),
    copyToChannel: vi.fn(),
  } as unknown as AudioBuffer;
}

function mockAudioContext() {
  const gainNode = {
    connect: vi.fn(),
    gain: {
      setValueAtTime: vi.fn(),
      value: 1,
    },
    context: { currentTime: 0 },
  };

  const sources: Array<{ onended: (() => void) | null; stop: ReturnType<typeof vi.fn>; start: ReturnType<typeof vi.fn> }> = [];

  const ctx = {
    state: "running" as AudioContextState,
    destination: {},
    createGain: vi.fn(() => gainNode),
    createBufferSource: vi.fn(() => {
      const source = {
        buffer: null as AudioBuffer | null,
        connect: vi.fn(),
        start: vi.fn(),
        stop: vi.fn(),
        onended: null as (() => void) | null,
      };
      sources.push(source);
      return source;
    }),
    decodeAudioData: vi.fn(async () => mockAudioBuffer()),
    resume: vi.fn(async () => {}),
    close: vi.fn(async () => {}),
  };

  return { ctx, gainNode, sources };
}

function snap(actor: ReturnType<typeof createActor<typeof audioPlaybackMachine>>) {
  return actor.getSnapshot();
}

describe("audioPlayback.machine", () => {
  let origAudioContext: typeof globalThis.AudioContext;

  beforeEach(() => {
    vi.useFakeTimers();
    origAudioContext = globalThis.AudioContext;
  });

  afterEach(() => {
    vi.useRealTimers();
    globalThis.AudioContext = origAudioContext;
  });

  it("starts in idle state", () => {
    const actor = createActor(audioPlaybackMachine);
    actor.start();
    expect(snap(actor).value).toBe("idle");
    expect(snap(actor).context.audioContext).toBeNull();
    expect(snap(actor).context.gainNode).toBeNull();
    actor.stop();
  });

  it("INIT_CONTEXT creates audioContext and gainNode atomically", () => {
    const mock = mockAudioContext();
    globalThis.AudioContext = vi.fn(() => mock.ctx) as any;

    const actor = createActor(audioPlaybackMachine);
    actor.start();

    actor.send({ type: "INIT_CONTEXT" });
    expect(snap(actor).context.audioContext).toBe(mock.ctx);
    expect(snap(actor).context.gainNode).not.toBeNull();
    expect(mock.ctx.createGain).toHaveBeenCalledOnce();
    expect(mock.gainNode.connect).toHaveBeenCalledWith(mock.ctx.destination);

    actor.stop();
  });

  it("INIT_CONTEXT guard prevents double-init", () => {
    const mock = mockAudioContext();
    let callCount = 0;
    globalThis.AudioContext = vi.fn(() => {
      callCount++;
      return mock.ctx;
    }) as any;

    const actor = createActor(audioPlaybackMachine);
    actor.start();

    actor.send({ type: "INIT_CONTEXT" });
    actor.send({ type: "INIT_CONTEXT" });
    expect(callCount).toBe(1);

    actor.stop();
  });

  it("ENQUEUE_AUDIO before INIT_CONTEXT is a no-op", () => {
    const actor = createActor(audioPlaybackMachine);
    actor.start();

    actor.send({ type: "ENQUEUE_AUDIO", buffer: new ArrayBuffer(8) });
    expect(snap(actor).value).toBe("idle");
    expect(snap(actor).context.queue).toHaveLength(0);

    actor.stop();
  });

  it("AUDIO_DECODED transitions from idle to playing", () => {
    const mock = mockAudioContext();
    globalThis.AudioContext = vi.fn(() => mock.ctx) as any;

    const actor = createActor(audioPlaybackMachine);
    actor.start();
    actor.send({ type: "INIT_CONTEXT" });

    const buf = mockAudioBuffer();
    actor.send({ type: "AUDIO_DECODED", audioBuffer: buf });

    expect(snap(actor).value).toEqual({ playing: "draining" });
    expect(snap(actor).context.queue).toHaveLength(1);
    expect(snap(actor).context.isPlaying).toBe(true);

    actor.stop();
  });

  it("AUDIO_ENDED with empty queue returns to idle", () => {
    const mock = mockAudioContext();
    globalThis.AudioContext = vi.fn(() => mock.ctx) as any;

    const actor = createActor(audioPlaybackMachine);
    actor.start();
    actor.send({ type: "INIT_CONTEXT" });

    actor.send({ type: "AUDIO_DECODED", audioBuffer: mockAudioBuffer() });
    expect(snap(actor).value).toEqual({ playing: "draining" });

    actor.send({ type: "AUDIO_ENDED" });
    expect(snap(actor).value).toBe("idle");
    expect(snap(actor).context.isPlaying).toBe(false);

    actor.stop();
  });

  it("queue draining plays buffers sequentially", () => {
    const mock = mockAudioContext();
    globalThis.AudioContext = vi.fn(() => mock.ctx) as any;

    const actor = createActor(audioPlaybackMachine);
    actor.start();
    actor.send({ type: "INIT_CONTEXT" });

    actor.send({ type: "AUDIO_DECODED", audioBuffer: mockAudioBuffer() });
    actor.send({ type: "AUDIO_DECODED", audioBuffer: mockAudioBuffer() });
    expect(snap(actor).context.queue).toHaveLength(2);

    actor.send({ type: "AUDIO_ENDED" });
    expect(snap(actor).value).toEqual({ playing: "draining" });
    expect(snap(actor).context.queue).toHaveLength(1);

    actor.send({ type: "AUDIO_ENDED" });
    expect(snap(actor).value).toBe("idle");

    actor.stop();
  });

  it("queue full (8 items) drops new buffers in idle", () => {
    const mock = mockAudioContext();
    globalThis.AudioContext = vi.fn(() => mock.ctx) as any;

    const actor = createActor(audioPlaybackMachine);
    actor.start();
    actor.send({ type: "INIT_CONTEXT" });

    for (let i = 0; i < 8; i++) {
      actor.send({ type: "AUDIO_DECODED", audioBuffer: mockAudioBuffer() });
    }
    expect(snap(actor).context.queue).toHaveLength(8);

    actor.send({ type: "AUDIO_DECODED", audioBuffer: mockAudioBuffer() });
    expect(snap(actor).context.queue).toHaveLength(8);

    actor.stop();
  });

  it("STOP_PLAYBACK clears queue and returns to idle from playing", () => {
    const mock = mockAudioContext();
    globalThis.AudioContext = vi.fn(() => mock.ctx) as any;

    const actor = createActor(audioPlaybackMachine);
    actor.start();
    actor.send({ type: "INIT_CONTEXT" });

    actor.send({ type: "AUDIO_DECODED", audioBuffer: mockAudioBuffer() });
    actor.send({ type: "AUDIO_DECODED", audioBuffer: mockAudioBuffer() });
    expect(snap(actor).value).toEqual({ playing: "draining" });

    actor.send({ type: "STOP_PLAYBACK" });
    expect(snap(actor).value).toBe("idle");
    expect(snap(actor).context.queue).toHaveLength(0);
    expect(snap(actor).context.isPlaying).toBe(false);
    expect(snap(actor).context.currentSource).toBeNull();

    actor.stop();
  });

  it("speaking timeout (45s) returns to idle", () => {
    const mock = mockAudioContext();
    globalThis.AudioContext = vi.fn(() => mock.ctx) as any;

    const actor = createActor(audioPlaybackMachine);
    actor.start();
    actor.send({ type: "INIT_CONTEXT" });

    actor.send({ type: "AUDIO_DECODED", audioBuffer: mockAudioBuffer() });
    expect(snap(actor).value).toEqual({ playing: "draining" });

    vi.advanceTimersByTime(45_000);
    expect(snap(actor).value).toBe("idle");
    expect(snap(actor).context.queue).toHaveLength(0);

    actor.stop();
  });

  it("STOP_PLAYBACK from idle is a no-op (stays idle)", () => {
    const actor = createActor(audioPlaybackMachine);
    actor.start();
    expect(snap(actor).value).toBe("idle");

    actor.send({ type: "STOP_PLAYBACK" });
    expect(snap(actor).value).toBe("idle");

    actor.stop();
  });

  it("AUDIO_DECODED while playing queues buffers", () => {
    const mock = mockAudioContext();
    globalThis.AudioContext = vi.fn(() => mock.ctx) as any;

    const actor = createActor(audioPlaybackMachine);
    actor.start();
    actor.send({ type: "INIT_CONTEXT" });

    actor.send({ type: "AUDIO_DECODED", audioBuffer: mockAudioBuffer() });
    expect(snap(actor).value).toEqual({ playing: "draining" });

    actor.send({ type: "AUDIO_DECODED", audioBuffer: mockAudioBuffer() });
    actor.send({ type: "AUDIO_DECODED", audioBuffer: mockAudioBuffer() });
    expect(snap(actor).context.queue).toHaveLength(3);

    actor.stop();
  });
});

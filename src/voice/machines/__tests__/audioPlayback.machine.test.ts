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

function installAudioContextMock() {
  const gainNode = {
    connect: vi.fn(),
    gain: { setValueAtTime: vi.fn(), value: 1 },
    context: { currentTime: 0 },
  };

  const sources: Array<{
    buffer: AudioBuffer | null;
    onended: (() => void) | null;
    connect: ReturnType<typeof vi.fn>;
    start: ReturnType<typeof vi.fn>;
    stop: ReturnType<typeof vi.fn>;
  }> = [];

  class MockAudioContext {
    state: AudioContextState = "running";
    destination = {};
    createGain = vi.fn(() => gainNode);
    createBufferSource = vi.fn(() => {
      const src = {
        buffer: null as AudioBuffer | null,
        connect: vi.fn(),
        start: vi.fn(),
        stop: vi.fn(),
        onended: null as (() => void) | null,
      };
      sources.push(src);
      return src;
    });
    decodeAudioData = vi.fn(async () => mockAudioBuffer());
    resume = vi.fn(async () => {});
    close = vi.fn(async () => {});
  }

  globalThis.AudioContext = MockAudioContext as any;
  return { gainNode, sources, MockAudioContext };
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
    const mock = installAudioContextMock();

    const actor = createActor(audioPlaybackMachine);
    actor.start();

    actor.send({ type: "INIT_CONTEXT" });
    const ctx = snap(actor).context;
    expect(ctx.audioContext).not.toBeNull();
    expect(ctx.audioContext).toBeInstanceOf(mock.MockAudioContext);
    expect(ctx.gainNode).not.toBeNull();
    expect(mock.gainNode.connect).toHaveBeenCalled();

    actor.stop();
  });

  it("INIT_CONTEXT guard prevents double-init", () => {
    let constructCount = 0;
    class TrackingAudioContext {
      state: AudioContextState = "running";
      destination = {};
      constructor() { constructCount++; }
      createGain = vi.fn(() => ({
        connect: vi.fn(),
        gain: { setValueAtTime: vi.fn(), value: 1 },
        context: { currentTime: 0 },
      }));
      createBufferSource = vi.fn();
      decodeAudioData = vi.fn();
      resume = vi.fn();
      close = vi.fn();
    }
    globalThis.AudioContext = TrackingAudioContext as any;

    const actor = createActor(audioPlaybackMachine);
    actor.start();

    actor.send({ type: "INIT_CONTEXT" });
    actor.send({ type: "INIT_CONTEXT" });
    expect(constructCount).toBe(1);

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
    installAudioContextMock();

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
    installAudioContextMock();

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
    installAudioContextMock();

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
    installAudioContextMock();

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
    installAudioContextMock();

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
    installAudioContextMock();

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
    installAudioContextMock();

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

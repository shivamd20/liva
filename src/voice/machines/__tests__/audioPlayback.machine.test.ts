import { describe, it, expect, vi, beforeEach, afterEach } from "vitest";
import { createActor } from "xstate";
import { audioPlaybackMachine } from "../audioPlayback.machine";

class MockAudioBuffer {
  length = 1024;
  duration = 0.5;
  sampleRate = 44100;
  numberOfChannels = 1;
  getChannelData = vi.fn(() => new Float32Array(1024));
  copyFromChannel = vi.fn();
  copyToChannel = vi.fn();
}

class MockAudioBufferSourceNode {
  buffer: any = null;
  onended: (() => void) | null = null;
  connect = vi.fn(() => this);
  start = vi.fn(() => {
    setTimeout(() => this.onended?.(), 100);
  });
  stop = vi.fn();
  disconnect = vi.fn();
  addEventListener = vi.fn();
  removeEventListener = vi.fn();
  dispatchEvent = vi.fn();
  loop = false;
  loopStart = 0;
  loopEnd = 0;
  playbackRate = { value: 1, setValueAtTime: vi.fn() } as any;
  detune = { value: 0, setValueAtTime: vi.fn() } as any;
  channelCount = 2;
  channelCountMode = "max" as const;
  channelInterpretation = "speakers" as const;
  context = {} as any;
  numberOfInputs = 0;
  numberOfOutputs = 1;
}

class MockGainNode {
  gain = {
    value: 1,
    setValueAtTime: vi.fn(),
    linearRampToValueAtTime: vi.fn(),
    exponentialRampToValueAtTime: vi.fn(),
    setTargetAtTime: vi.fn(),
    cancelScheduledValues: vi.fn(),
  } as any;
  connect = vi.fn(() => this);
  disconnect = vi.fn();
  context = { currentTime: 0 } as any;
}

function setupWebAudioMock() {
  const mockGainNode = new MockGainNode();

  (globalThis as any).AudioContext = class {
    state = "running";
    currentTime = 0;
    destination = {};
    createGain = vi.fn(() => mockGainNode);
    createBufferSource = vi.fn(() => new MockAudioBufferSourceNode());
    decodeAudioData = vi.fn(async () => new MockAudioBuffer() as unknown as AudioBuffer);
    resume = vi.fn();
    close = vi.fn();
  };

  (globalThis as any).AudioBuffer = MockAudioBuffer;

  return { mockGainNode };
}

function snap(actor: any) {
  return actor.getSnapshot();
}

describe("audioPlayback.machine", () => {
  beforeEach(() => {
    vi.useFakeTimers();
    setupWebAudioMock();
  });
  afterEach(() => {
    vi.useRealTimers();
  });

  // C1: INIT_CONTEXT creates audioContext and gainNode
  it("C1: INIT_CONTEXT sets up audioContext and gainNode", () => {
    const actor = createActor(audioPlaybackMachine);
    actor.start();

    expect(snap(actor).context.audioContext).toBeNull();
    actor.send({ type: "INIT_CONTEXT" });
    expect(snap(actor).context.audioContext).not.toBeNull();
    expect(snap(actor).context.gainNode).not.toBeNull();

    actor.stop();
  });

  // C2: AUDIO_DECODED in idle -> playing
  it("C2: AUDIO_DECODED in idle transitions to playing", () => {
    const actor = createActor(audioPlaybackMachine);
    actor.start();
    actor.send({ type: "INIT_CONTEXT" });

    const mockBuffer = new MockAudioBuffer() as unknown as AudioBuffer;
    actor.send({ type: "AUDIO_DECODED", audioBuffer: mockBuffer });
    expect(snap(actor).value).toEqual({ playing: "draining" });
    expect(snap(actor).context.isPlaying).toBe(true);

    actor.stop();
  });

  // C3: Queue overflow - 9th buffer dropped when queue has 8
  it("C3: AUDIO_DECODED is silently dropped when queue is full (8)", () => {
    const actor = createActor(audioPlaybackMachine);
    actor.start();
    actor.send({ type: "INIT_CONTEXT" });

    for (let i = 0; i < 9; i++) {
      actor.send({ type: "AUDIO_DECODED", audioBuffer: new MockAudioBuffer() as unknown as AudioBuffer });
    }

    expect(snap(actor).context.queue.length).toBeLessThanOrEqual(8);

    actor.stop();
  });

  // C4: STOP_PLAYBACK during playing clears queue
  it("C4: STOP_PLAYBACK clears queue and returns to idle", () => {
    const actor = createActor(audioPlaybackMachine);
    actor.start();
    actor.send({ type: "INIT_CONTEXT" });

    actor.send({ type: "AUDIO_DECODED", audioBuffer: new MockAudioBuffer() as unknown as AudioBuffer });
    expect(snap(actor).value).toEqual({ playing: "draining" });

    actor.send({ type: "STOP_PLAYBACK" });
    expect(snap(actor).value).toBe("idle");
    expect(snap(actor).context.queue).toHaveLength(0);
    expect(snap(actor).context.isPlaying).toBe(false);

    actor.stop();
  });

  // C5: SET_VOLUME clamps between 0 and 1
  it("C5: SET_VOLUME clamps values to [0, 1]", () => {
    const { mockGainNode } = setupWebAudioMock();
    const actor = createActor(audioPlaybackMachine);
    actor.start();
    actor.send({ type: "INIT_CONTEXT" });

    actor.send({ type: "SET_VOLUME", value: 1.5 });
    expect(mockGainNode.gain.setValueAtTime).toHaveBeenCalledWith(1, expect.any(Number));

    actor.send({ type: "SET_VOLUME", value: -0.5 });
    expect(mockGainNode.gain.setValueAtTime).toHaveBeenCalledWith(0, expect.any(Number));

    actor.send({ type: "SET_VOLUME", value: 0.7 });
    expect(mockGainNode.gain.setValueAtTime).toHaveBeenCalledWith(0.7, expect.any(Number));

    actor.stop();
  });

  // C6: AUDIO_ENDED with empty queue -> idle
  it("C6: AUDIO_ENDED with empty queue returns to idle", async () => {
    const actor = createActor(audioPlaybackMachine);
    actor.start();
    actor.send({ type: "INIT_CONTEXT" });

    actor.send({ type: "AUDIO_DECODED", audioBuffer: new MockAudioBuffer() as unknown as AudioBuffer });
    expect(snap(actor).value).toEqual({ playing: "draining" });

    await vi.advanceTimersByTimeAsync(100);
    expect(snap(actor).value).toBe("idle");
    expect(snap(actor).context.isPlaying).toBe(false);

    actor.stop();
  });

  // C7: AUDIO_ENDED with queued buffers re-enters draining
  it("C7: AUDIO_ENDED with more buffers re-enters draining", async () => {
    const actor = createActor(audioPlaybackMachine);
    actor.start();
    actor.send({ type: "INIT_CONTEXT" });

    actor.send({ type: "AUDIO_DECODED", audioBuffer: new MockAudioBuffer() as unknown as AudioBuffer });
    actor.send({ type: "AUDIO_DECODED", audioBuffer: new MockAudioBuffer() as unknown as AudioBuffer });

    expect(snap(actor).context.queue.length).toBeGreaterThanOrEqual(1);

    await vi.advanceTimersByTimeAsync(100);
    expect(snap(actor).value).toEqual({ playing: "draining" });

    actor.stop();
  });

  // C8: Speaking timeout (45s) -> idle
  it("C8: speaking timeout (45s) returns to idle", async () => {
    const actor = createActor(audioPlaybackMachine);
    actor.start();
    actor.send({ type: "INIT_CONTEXT" });

    // Queue several buffers so drain doesn't finish before timeout
    for (let i = 0; i < 5; i++) {
      actor.send({ type: "AUDIO_DECODED", audioBuffer: new MockAudioBuffer() as unknown as AudioBuffer });
    }
    expect(snap(actor).value).toEqual({ playing: "draining" });

    await vi.advanceTimersByTimeAsync(45_000);
    expect(snap(actor).value).toBe("idle");
    expect(snap(actor).context.isPlaying).toBe(false);

    actor.stop();
  });
});

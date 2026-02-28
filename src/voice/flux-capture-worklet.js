/**
 * AudioWorklet for Flux: captures at 16 kHz, outputs linear16 PCM chunks.
 */
const CHUNK_SAMPLES = 4096;

class FluxCaptureProcessor extends AudioWorkletProcessor {
  constructor() {
    super();
    this.buffer = new Float32Array(CHUNK_SAMPLES);
    this.offset = 0;
  }

  process(inputs, _outputs, _params) {
    const input = inputs[0]?.[0];
    if (!input || input.length === 0) return true;

    let inIdx = 0;
    while (inIdx < input.length) {
      const toCopy = Math.min(CHUNK_SAMPLES - this.offset, input.length - inIdx);
      this.buffer.set(input.subarray(inIdx, inIdx + toCopy), this.offset);
      this.offset += toCopy;
      inIdx += toCopy;

      if (this.offset === CHUNK_SAMPLES) {
        const pcm = new Int16Array(CHUNK_SAMPLES);
        for (let i = 0; i < CHUNK_SAMPLES; i++) {
          const s = Math.max(-1, Math.min(1, this.buffer[i]));
          pcm[i] = s < 0 ? s * 0x8000 : s * 0x7fff;
        }
        this.port.postMessage({ chunk: pcm.buffer }, [pcm.buffer]);
        this.offset = 0;
      }
    }
    return true;
  }
}

registerProcessor("flux-capture-processor", FluxCaptureProcessor);

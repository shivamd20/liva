export const base64ToUint8Array = (base64: string): Uint8Array => {
    const binaryString = atob(base64);
    const bytes = new Uint8Array(binaryString.length);
    for (let i = 0; i < binaryString.length; i++) {
        bytes[i] = binaryString.charCodeAt(i);
    }
    return bytes;
};

export const arrayBufferToBase64 = (buffer: ArrayBuffer): string => {
    let binary = '';
    const bytes = new Uint8Array(buffer);
    const len = bytes.byteLength;
    for (let i = 0; i < len; i++) {
        binary += String.fromCharCode(bytes[i]);
    }
    return btoa(binary);
};

export const decodeAudioData = async (
    audioData: Uint8Array,
    audioContext: AudioContext
): Promise<AudioBuffer> => {
    const arrayBuffer = audioData.buffer.slice(
        audioData.byteOffset,
        audioData.byteOffset + audioData.byteLength
    );
    return await audioContext.decodeAudioData(arrayBuffer as ArrayBuffer);
};

export const createPcmBlob = (inputData: Float32Array): Blob => {
    const buffer = new ArrayBuffer(inputData.length * 2);
    const view = new DataView(buffer);
    for (let i = 0; i < inputData.length; i++) {
        // Float to Int16 PCM
        let s = Math.max(-1, Math.min(1, inputData[i]));
        s = s < 0 ? s * 0x8000 : s * 0x7FFF;
        view.setInt16(i * 2, s, true);
    }
    return new Blob([view], { type: 'audio/pcm; rate=16000' });
}

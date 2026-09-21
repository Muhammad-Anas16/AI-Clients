export const pcmToWav = (chunks, sampleRate = 16000, channels = 1) => {
  if (!chunks || chunks.length === 0) {
    throw new Error("No PCM audio available.");
  }

  // ==========================================
  // TOTAL PCM SIZE
  // ==========================================

  let totalLength = 0;

  for (const chunk of chunks) {
    totalLength += chunk.byteLength;
  }

  if (totalLength <= 0) {
    throw new Error("PCM audio is empty.");
  }

  // ==========================================
  // COMBINE PCM CHUNKS
  // ==========================================

  const pcmData = new Uint8Array(totalLength);

  let offset = 0;

  for (const chunk of chunks) {
    const bytes = new Uint8Array(chunk);

    pcmData.set(bytes, offset);

    offset += bytes.length;
  }

  // ==========================================
  // WAV SETTINGS
  // ==========================================

  const bitsPerSample = 16;
  const bytesPerSample = 2;

  const blockAlign = channels * bytesPerSample;

  const byteRate = sampleRate * blockAlign;

  const wavSize = 44 + pcmData.length;

  // ==========================================
  // CREATE WAV
  // ==========================================

  const wavBuffer = new ArrayBuffer(wavSize);

  const view = new DataView(wavBuffer);

  // RIFF
  writeString(view, 0, "RIFF");

  view.setUint32(4, 36 + pcmData.length, true);

  // WAVE
  writeString(view, 8, "WAVE");

  // fmt
  writeString(view, 12, "fmt ");

  view.setUint32(16, 16, true);

  // PCM format
  view.setUint16(20, 1, true);

  // Channels
  view.setUint16(22, channels, true);

  // Sample rate
  view.setUint32(24, sampleRate, true);

  // Byte rate
  view.setUint32(28, byteRate, true);

  // Block align
  view.setUint16(32, blockAlign, true);

  // Bits per sample
  view.setUint16(34, bitsPerSample, true);

  // data
  writeString(view, 36, "data");

  view.setUint32(40, pcmData.length, true);

  // ==========================================
  // COPY PCM DATA
  // ==========================================

  const wavBytes = new Uint8Array(wavBuffer);

  wavBytes.set(pcmData, 44);

  // IMPORTANT:
  // Uint8Array return hoga
  return wavBytes;
};

// ==========================================
// WRITE STRING
// ==========================================

const writeString = (view, offset, text) => {
  for (let i = 0; i < text.length; i++) {
    view.setUint8(offset + i, text.charCodeAt(i));
  }
};

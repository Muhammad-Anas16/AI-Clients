export function pcmToWav(chunks, sampleRate = 16000, channels = 1) {
  if (!chunks || chunks.length === 0) {
    throw new Error("No PCM audio available");
  }

  let totalLength = 0;

  for (const chunk of chunks) {
    totalLength += chunk.byteLength;
  }

  const pcmData = new Uint8Array(totalLength);

  let offset = 0;

  for (const chunk of chunks) {
    const bytes = new Uint8Array(chunk);

    pcmData.set(bytes, offset);

    offset += bytes.length;
  }

  const bytesPerSample = 2;
  const blockAlign = channels * bytesPerSample;

  const byteRate = sampleRate * blockAlign;

  const wavSize = 44 + pcmData.byteLength;

  const wavBuffer = new ArrayBuffer(wavSize);

  const view = new DataView(wavBuffer);

  // ========================================
  // WAV HEADER
  // ========================================

  writeString(view, 0, "RIFF");

  view.setUint32(4, 36 + pcmData.byteLength, true);

  writeString(view, 8, "WAVE");

  writeString(view, 12, "fmt ");

  view.setUint32(16, 16, true);

  // PCM format
  view.setUint16(20, 1, true);

  view.setUint16(22, channels, true);

  view.setUint32(24, sampleRate, true);

  view.setUint32(28, byteRate, true);

  view.setUint16(32, blockAlign, true);

  view.setUint16(34, 16, true);

  writeString(view, 36, "data");

  view.setUint32(40, pcmData.byteLength, true);

  // ========================================
  // PCM DATA
  // ========================================

  new Uint8Array(wavBuffer, 44).set(pcmData);

  return new Blob([wavBuffer], {
    type: "audio/wav",
  });
}

function writeString(view, offset, text) {
  for (let i = 0; i < text.length; i++) {
    view.setUint8(offset + i, text.charCodeAt(i));
  }
}

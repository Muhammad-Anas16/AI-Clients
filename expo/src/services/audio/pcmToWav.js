export const pcmToWav = (chunks, sampleRate = 16000, channels = 1) => {
  if (!chunks || chunks.length === 0) {
    throw new Error("No PCM audio available.");
  }

  let totalLength = 0;

  for (const chunk of chunks) {
    totalLength += chunk.byteLength;
  }

  if (totalLength <= 0) {
    throw new Error("PCM audio is empty.");
  }

  const pcmData = new Uint8Array(totalLength);

  let offset = 0;

  for (const chunk of chunks) {
    const bytes = new Uint8Array(chunk);

    pcmData.set(bytes, offset);

    offset += bytes.length;
  }

  const bitsPerSample = 16;

  const bytesPerSample = 2;

  const blockAlign = channels * bytesPerSample;

  const byteRate = sampleRate * blockAlign;

  const wavSize = 44 + pcmData.length;

  const wavBuffer = new ArrayBuffer(wavSize);

  const view = new DataView(wavBuffer);

  writeString(view, 0, "RIFF");

  view.setUint32(4, 36 + pcmData.length, true);

  writeString(view, 8, "WAVE");

  writeString(view, 12, "fmt ");

  view.setUint32(16, 16, true);

  view.setUint16(20, 1, true);

  view.setUint16(22, channels, true);

  view.setUint32(24, sampleRate, true);

  view.setUint32(28, byteRate, true);

  view.setUint16(32, blockAlign, true);

  view.setUint16(34, bitsPerSample, true);

  writeString(view, 36, "data");

  view.setUint32(40, pcmData.length, true);

  const wavBytes = new Uint8Array(wavBuffer);

  wavBytes.set(pcmData, 44);

  return wavBytes;
};

const writeString = (view, offset, text) => {
  for (let i = 0; i < text.length; i++) {
    view.setUint8(offset + i, text.charCodeAt(i));
  }
};

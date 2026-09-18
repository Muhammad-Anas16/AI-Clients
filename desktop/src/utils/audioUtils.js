// Float32 -> 16-bit PCM
export const floatTo16BitPCM = (float32Array) => {
  const buffer = new ArrayBuffer(float32Array.length * 2);
  const view = new DataView(buffer);

  for (let i = 0; i < float32Array.length; i++) {
    const sample = Math.max(-1, Math.min(1, float32Array[i]));

    const value = sample < 0 ? sample * 0x8000 : sample * 0x7fff;

    view.setInt16(i * 2, value, true);
  }

  return new Uint8Array(buffer);
};

// Convert audio -> 16kHz
export const resampleTo16k = (float32Array, inputSampleRate) => {
  const targetRate = 16000;

  if (inputSampleRate === targetRate) {
    return float32Array;
  }

  const outputLength = Math.max(
    1,
    Math.round(float32Array.length * (targetRate / inputSampleRate)),
  );

  const result = new Float32Array(outputLength);
  const ratio = inputSampleRate / targetRate;

  for (let i = 0; i < outputLength; i++) {
    const position = i * ratio;
    const index = Math.floor(position);
    const nextIndex = Math.min(index + 1, float32Array.length - 1);

    const fraction = position - index;

    const current = float32Array[index] || 0;
    const next = float32Array[nextIndex] || 0;

    result[i] = current + (next - current) * fraction;
  }

  return result;
};

// Create WAV
export const encodeWav = (float32Array, sampleRate = 16000) => {
  const pcm = floatTo16BitPCM(float32Array);

  const buffer = new ArrayBuffer(44 + pcm.length);

  const view = new DataView(buffer);

  const writeString = (offset, value) => {
    for (let i = 0; i < value.length; i++) {
      view.setUint8(offset + i, value.charCodeAt(i));
    }
  };

  writeString(0, "RIFF");
  view.setUint32(4, 36 + pcm.length, true);

  writeString(8, "WAVE");

  writeString(12, "fmt ");
  view.setUint32(16, 16, true);
  view.setUint16(20, 1, true);
  view.setUint16(22, 1, true);

  view.setUint32(24, sampleRate, true);

  view.setUint32(28, sampleRate * 2, true);

  view.setUint16(32, 2, true);
  view.setUint16(34, 16, true);

  writeString(36, "data");

  view.setUint32(40, pcm.length, true);

  new Uint8Array(buffer, 44).set(pcm);

  return new Blob([buffer], {
    type: "audio/wav",
  });
};

// Decode uploaded file -> mono Float32
export const decodeAudioFileToMono = async (file) => {
  const AudioContext = window.AudioContext || window.webkitAudioContext;

  if (!AudioContext) {
    throw new Error("Web Audio API is not supported.");
  }

  const context = new AudioContext();

  try {
    const arrayBuffer = await file.arrayBuffer();

    const audioBuffer = await context.decodeAudioData(arrayBuffer);

    const channels = audioBuffer.numberOfChannels;

    const length = audioBuffer.length;

    const mono = new Float32Array(length);

    if (channels === 1) {
      mono.set(audioBuffer.getChannelData(0));
    } else {
      for (let c = 0; c < channels; c++) {
        const channel = audioBuffer.getChannelData(c);

        for (let i = 0; i < length; i++) {
          mono[i] += channel[i] / channels;
        }
      }
    }

    return {
      samples: mono,
      sampleRate: audioBuffer.sampleRate,
      duration: audioBuffer.duration,
    };
  } finally {
    if (context.state !== "closed") {
      await context.close();
    }
  }
};

// Get transcript
export const getTranscript = (response) => {
  if (!response) return "";

  if (typeof response === "string") {
    return response.trim();
  }

  const values = [
    response.text,
    response.transcript,
    response.result?.text,
    response.data?.text,
    response.data?.transcript,
    response.data?.result?.text,
    response.data?.data?.text,
    response.data?.data?.transcript,
  ];

  for (const value of values) {
    if (typeof value === "string" && value.trim()) {
      return value.trim();
    }
  }

  return "";
};

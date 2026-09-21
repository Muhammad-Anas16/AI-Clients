const MIN_START_LEVEL = 0.045;
const NOISE_MARGIN = 0.025;

const START_CONFIRM_BUFFERS = 3;
const SILENCE_BUFFERS = 10;

const MIN_SPEECH_MS = 350;
const MAX_SPEECH_MS = 15000;

export const VOICE_CONFIG = {
  sampleRate: 16000,
  channels: 1,
  encoding: "int16",

  startConfirmBuffers: START_CONFIRM_BUFFERS,
  silenceBuffers: SILENCE_BUFFERS,

  minSpeechMs: MIN_SPEECH_MS,
  maxSpeechMs: MAX_SPEECH_MS,
};

export const getRmsLevel = (data) => {
  if (!data || data.byteLength === 0) {
    return 0;
  }

  const view = new DataView(data);
  const sampleCount = Math.floor(data.byteLength / 2);

  if (sampleCount <= 0) {
    return 0;
  }

  let sum = 0;

  for (let i = 0; i < sampleCount; i++) {
    const sample = view.getInt16(i * 2, true);
    const normalized = sample / 32768;

    sum += normalized * normalized;
  }

  return Math.sqrt(sum / sampleCount);
};

export const updateNoiseFloor = (currentNoise, rms) => {
  if (currentNoise <= 0) {
    return rms;
  }

  return currentNoise * 0.95 + rms * 0.05;
};

export const getSpeechThreshold = (noiseFloor) => {
  return Math.max(MIN_START_LEVEL, noiseFloor + NOISE_MARGIN);
};

export const getStopThreshold = (startThreshold) => {
  return Math.max(0.018, startThreshold * 0.65);
};

export const isVoiceLevel = (rms, threshold) => {
  return rms >= threshold;
};

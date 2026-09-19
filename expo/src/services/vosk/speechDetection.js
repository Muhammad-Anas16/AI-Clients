export function calculateRMS(arrayBuffer) {
  if (!arrayBuffer) {
    return 0;
  }

  const samples = new Int16Array(arrayBuffer);

  if (samples.length === 0) {
    return 0;
  }

  let sum = 0;

  for (let i = 0; i < samples.length; i++) {
    const normalized = samples[i] / 32768;

    sum += normalized * normalized;
  }

  return Math.sqrt(sum / samples.length);
}

export function detectSpeech(arrayBuffer, threshold = 0.025) {
  const rms = calculateRMS(arrayBuffer);

  return {
    rms,
    speech: rms >= threshold,
  };
}

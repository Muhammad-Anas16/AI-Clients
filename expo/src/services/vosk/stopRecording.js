export async function stopRecording(recorder) {
  if (!recorder) {
    return null;
  }

  if (!recorder.isRecording) {
    return recorder.uri || null;
  }

  await recorder.stop();

  return recorder.uri || null;
}

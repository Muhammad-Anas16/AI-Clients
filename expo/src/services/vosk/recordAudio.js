export async function startRecording(recorder) {
  if (!recorder) {
    throw new Error("Recorder not available");
  }

  if (recorder.isRecording) {
    return true;
  }

  await recorder.prepareToRecordAsync();
  recorder.record();

  console.log("Listening started...");

  return true;
}

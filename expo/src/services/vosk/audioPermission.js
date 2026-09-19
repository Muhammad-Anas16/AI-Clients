import { AudioModule, setAudioModeAsync } from "expo-audio";

export async function requestAudioPermission() {
  const permission = await AudioModule.requestRecordingPermissionsAsync();

  if (!permission.granted) {
    throw new Error("Microphone permission denied");
  }

  await setAudioModeAsync({
    allowsRecording: true,
    playsInSilentMode: true,
  });

  return true;
}

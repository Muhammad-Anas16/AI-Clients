import { File, Paths } from "expo-file-system";

export const saveWavForPlayback = async (wavBytes) => {
  if (!wavBytes || wavBytes.length === 0) {
    throw new Error("No WAV audio available.");
  }

  if (!(wavBytes instanceof Uint8Array)) {
    throw new Error("WAV data must be Uint8Array.");
  }

  const fileName = `voice-${Date.now()}.wav`;

  const file = new File(Paths.cache, fileName);

  file.create({
    overwrite: true,
  });

  file.write(wavBytes);

  if (!file.exists) {
    throw new Error("WAV file was not created.");
  }

  console.log("WAV saved:", file.uri, "Size:", file.size);

  return file.uri;
};

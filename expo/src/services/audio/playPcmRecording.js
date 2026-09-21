import { File, Paths } from "expo-file-system";

export const saveWavFile = async (wavBytes, prefix = "voice") => {
  if (!wavBytes || wavBytes.length === 0) {
    throw new Error("No WAV audio available.");
  }

  if (!(wavBytes instanceof Uint8Array)) {
    throw new Error("WAV data must be Uint8Array.");
  }

  const fileName = `${prefix}-${Date.now()}-${Math.random()
    .toString(36)
    .slice(2, 8)}.wav`;

  const file = new File(Paths.cache, fileName);

  file.create({
    overwrite: true,
  });

  file.write(wavBytes);

  if (!file.exists) {
    throw new Error("WAV file was not created.");
  }

  return file.uri;
};

export const saveWavForPlayback = async (wavBytes) => {
  return await saveWavFile(wavBytes, "playback");
};

export const saveWavForVosk = async (wavBytes) => {
  return await saveWavFile(wavBytes, "vosk");
};

export const deleteWavFile = async (uri) => {
  if (!uri) {
    return false;
  }

  try {
    const file = new File(uri);

    if (file.exists) {
      file.delete();
    }

    return true;
  } catch (error) {
    console.error("Delete WAV error:", error);

    return false;
  }
};

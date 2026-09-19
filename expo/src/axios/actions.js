import axios from "axios";
import { getIp } from "./api";

// AXIOS CLIENT
export const getHttp = async () => {
  const baseURL = await getIp();

  if (!baseURL) {
    throw new Error("Server URL is not configured");
  }

  return axios.create({
    baseURL,
    timeout: 120000,
  });
};

// VOSK TRANSCRIBE
export const transcribeAudio = async (wavBlob) => {
  if (!(wavBlob instanceof Blob)) {
    throw new Error("Audio data is not a valid Blob.");
  }

  const formData = new FormData();

  // Server expects:
  // audio = recording.wav
  formData.append("audio", wavBlob, "recording.wav");

  try {
    const http = await getHttp();

    const result = await http.post("/vosk/transcribe", formData, {
      timeout: 120000,
    });

    console.log("Vosk Response =>", result.data);

    return result.data;
  } catch (error) {
    console.error("Vosk Transcribe Error:", error);

    if (error.response) {
      console.error("Server Response:", error.response.data);
    }

    throw error;
  }
};

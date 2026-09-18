import axios from "axios";

// SERVER CONFIG
export const API_BASE_URL = "http://192.168.1.57:3000/api/";

// Axios client
const http = axios.create({
  baseURL: API_BASE_URL,
  timeout: 120000,
});

// Status
export const checkServerStatus = async () => {
  const result = await http.get("status");
  return result.data;
};

export const checkVoskStatus = async () => {
  const result = await http.get("vosk/status");
  return result.data;
};

export const checkPiperStatus = async () => {
  const result = await http.get("piper/status");
  return result.data;
};

// Llama Function
export const AskLlama = async (prompt) => {
  try {
    const result = await http.post("llama/chat", {
      prompt: prompt,
    });

    return result.data;
  } catch (error) {
    console.error("Llama API Error:", error);
    throw error;
  }
};

// Piper Function
export const ListenPiper = async (text) => {
  try {
    const result = await http.post(
      "piper/synthesize",
      {
        text,
      },
      {
        responseType: "arraybuffer",
      },
    );

    return result.data;
  } catch (error) {
    console.error("Llama API Error:", error);
    throw error;
  }
};

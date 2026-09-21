import axios from "axios";

import { fetch as expoFetch } from "expo/fetch";

import { File } from "expo-file-system";

import { getServerURL } from "../utils/ipStorage";

// ============================================================
// API URL
// ============================================================

export const getIp = async () => {
  try {
    const url = await getServerURL();

    if (!url) {
      return null;
    }

    return `${url.replace(/\/+$/, "")}/api`;
  } catch (error) {
    console.log("Server URL not available:", error?.message);

    return null;
  }
};

// ============================================================
// HTTP
// ============================================================

export const getHttp = async () => {
  const baseURL = await getIp();

  if (!baseURL) {
    return null;
  }

  return axios.create({
    baseURL,
    timeout: 120000,
  });
};

// ============================================================
// SERVER STATUS
// ============================================================

export const checkServerStatus = async () => {
  try {
    const http = await getHttp();

    if (!http) {
      return {
        success: false,
        message: "Server is not configured",
      };
    }

    const result = await http.get("status");

    return result.data;
  } catch (error) {
    console.log("Server status error:", error?.message);

    return {
      success: false,
      message: "Server is not connected",
    };
  }
};

// ============================================================
// VOSK STATUS
// ============================================================

export const checkVoskStatus = async () => {
  try {
    const http = await getHttp();

    if (!http) {
      return {
        success: false,
        message: "Server is not configured",
      };
    }

    const result = await http.get("vosk/status");

    return result.data;
  } catch (error) {
    console.log("Vosk status error:", error?.message);

    return {
      success: false,
      message: "Vosk is not connected",
    };
  }
};

// ============================================================
// PIPER STATUS
// ============================================================

export const checkPiperStatus = async () => {
  try {
    const http = await getHttp();

    if (!http) {
      return {
        success: false,
        message: "Server is not configured",
      };
    }

    const result = await http.get("piper/status");

    return result.data;
  } catch (error) {
    console.log("Piper status error:", error?.message);

    return {
      success: false,
      message: "Piper is not connected",
    };
  }
};

// ============================================================
// LLAMA
// ============================================================

export const AskLlama = async (prompt) => {
  try {
    const baseURL = await getIp();

    if (!baseURL) {
      return {
        success: false,
        message: "Server is not configured",
      };
    }

    if (!prompt || !String(prompt).trim()) {
      return {
        success: false,
        message: "Llama prompt is empty",
      };
    }

    console.log("Sending request to Llama...");

    const response = await expoFetch(`${baseURL}/llama/chat`, {
      method: "POST",

      headers: {
        "Content-Type": "application/json",
      },

      body: JSON.stringify({
        prompt: String(prompt),
      }),
    });

    const responseText = await response.text();

    let data;

    try {
      data = JSON.parse(responseText);
    } catch {
      data = {
        success: false,
        message: responseText || "Invalid Llama response",
      };
    }

    if (!response.ok) {
      console.log(
        "Llama HTTP Error:",
        response.status,
        data?.message || "Request failed",
      );

      return {
        success: false,
        message: data?.message || "Llama request failed",
        data: data?.data || null,
      };
    }

    console.log("Llama response received.");

    return data;
  } catch (error) {
    console.log("Llama error:", error?.message);

    return {
      success: false,
      message: error?.message || "Llama is not available",
    };
  }
};

// ============================================================
// PIPER
// ============================================================

export const ListenPiper = async (text) => {
  try {
    const baseURL = await getIp();

    if (!baseURL) {
      return {
        success: false,
        message: "Server is not configured",
      };
    }

    if (!text || !String(text).trim()) {
      return {
        success: false,
        message: "Piper text is empty",
      };
    }

    const response = await expoFetch(`${baseURL}/piper/synthesize`, {
      method: "POST",

      headers: {
        "Content-Type": "application/json",
      },

      body: JSON.stringify({
        text: String(text),
      }),
    });

    if (!response.ok) {
      const errorText = await response.text();

      return {
        success: false,
        message: errorText || "Piper is not available",
      };
    }

    const buffer = await response.arrayBuffer();

    const bytes = new Uint8Array(buffer);

    if (bytes.length === 0) {
      return {
        success: false,
        message: "Piper returned empty audio",
      };
    }

    return bytes;
  } catch (error) {
    console.log("Piper error:", error?.message);

    return {
      success: false,
      message: error?.message || "Piper is not available",
    };
  }
};

// ============================================================
// VOSK
// ============================================================

export const transcribeAudio = async (wavUri) => {
  try {
    const baseURL = await getIp();

    if (!baseURL) {
      return {
        success: false,
        message: "Server is not configured",
      };
    }

    if (!wavUri) {
      return {
        success: false,
        message: "WAV file URI is missing",
      };
    }

    const file = new File(wavUri);

    if (!file.exists) {
      return {
        success: false,
        message: "WAV file does not exist",
      };
    }

    const formData = new FormData();

    formData.append("audio", file);

    const response = await expoFetch(`${baseURL}/vosk/transcribe`, {
      method: "POST",
      body: formData,
    });

    const responseText = await response.text();

    let data;

    try {
      data = JSON.parse(responseText);
    } catch {
      data = {
        success: false,
        message: responseText || "Invalid server response",
      };
    }

    if (!response.ok) {
      return {
        success: false,
        message: data?.message || "Vosk transcription failed",
        data: data?.data || null,
      };
    }

    return data;
  } catch (error) {
    console.error("Vosk upload error:", error);

    return {
      success: false,
      message: error?.message || "Vosk transcription failed",
    };
  }
};

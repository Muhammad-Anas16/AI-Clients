import axios from "axios";

// ============================================================
// AI SERVER URL
// ============================================================

export const API_BASE_URL = String(
  import.meta.env.VITE_AI_SERVER_URL || "http://127.0.0.1:3000",
)
  .trim()
  .replace(/\/$/, "");

export const WS_BASE_URL = API_BASE_URL.replace(/^http:/i, "ws:").replace(
  /^https:/i,
  "wss:",
);

// ============================================================
// AXIOS CLIENT
// ============================================================

const http = axios.create({
  baseURL: API_BASE_URL,
  timeout: 120000,
});

// ============================================================
// ERROR
// ============================================================

function makeErrorMessage(error) {
  if (error?.code === "ECONNABORTED") {
    return "AI Server request timed out.";
  }

  if (!error?.response) {
    return `Cannot connect to AI Server at ${API_BASE_URL}. Make sure the server is running.`;
  }

  const data = error.response.data;

  if (data?.message) {
    return String(data.message);
  }

  if (data?.error) {
    return String(data.error);
  }

  if (typeof data === "string" && data.trim()) {
    return data;
  }

  return `Request failed with HTTP ${error.response.status}.`;
}

// ============================================================
// REQUEST
// ============================================================

async function request(path, options = {}) {
  const {
    method = "GET",
    data,
    headers = {},
    responseType = "json",
    timeout,
  } = options;

  try {
    const response = await http.request({
      url: path,
      method,
      data,
      headers,
      responseType,
      timeout,
    });

    if (responseType === "blob") {
      return {
        ok: true,
        status: response.status,
        blob: response.data,
        contentType:
          response.headers?.["content-type"] || "application/octet-stream",
      };
    }

    const result = response.data;

    if (result?.ok === false) {
      throw new Error(result?.message || "AI Server returned an error.");
    }

    return result;
  } catch (error) {
    if (error instanceof Error && error.message && !error.response) {
      throw error;
    }

    throw new Error(makeErrorMessage(error));
  }
}

// ============================================================
// SERVER
// ============================================================

export async function getServerStatus() {
  return request("/api/status");
}

export async function checkServer() {
  try {
    await getServerStatus();

    return true;
  } catch {
    return false;
  }
}

// ============================================================
// VOSK
// ============================================================

export async function getVoskStatus() {
  return request("/api/vosk/status");
}

export async function transcribeAudio(file, modelId = "english") {
  if (!file) {
    throw new Error("Audio file is required.");
  }

  const form = new FormData();

  form.append("audio", file);

  if (modelId) {
    form.append("modelId", modelId);
  }

  return request("/api/vosk/transcribe", {
    method: "POST",
    data: form,
  });
}

// ============================================================
// PIPER
// ============================================================

export async function getPiperStatus() {
  return request("/api/piper/status");
}

export async function warmupPiper(modelId = "urdu") {
  return request("/api/piper/warmup", {
    method: "POST",
    data: {
      modelId,
    },
  });
}

export async function synthesizeSpeech(text, modelId = "auto") {
  if (!text || !String(text).trim()) {
    throw new Error("Text is required.");
  }

  return request("/api/piper/synthesize", {
    method: "POST",
    data: {
      text: String(text).trim(),
      modelId,
    },
    responseType: "blob",
    timeout: 120000,
  });
}

// ============================================================
// AUDIO
// ============================================================

export function createAudioUrl(blob) {
  if (!(blob instanceof Blob)) {
    throw new Error("Invalid audio blob.");
  }

  return URL.createObjectURL(blob);
}

export async function playAudioBlob(blob) {
  const url = createAudioUrl(blob);

  const audio = new Audio(url);

  try {
    await audio.play();

    audio.addEventListener("ended", () => URL.revokeObjectURL(url), {
      once: true,
    });

    return audio;
  } catch (error) {
    URL.revokeObjectURL(url);

    throw error;
  }
}

// ============================================================
// LLAMA
// ============================================================

export async function getLlamaStatus() {
  return request("/api/llama/status");
}

export async function chat(prompt, modelId) {
  if (!prompt || !String(prompt).trim()) {
    throw new Error("Prompt is required.");
  }

  const data = {
    prompt: String(prompt).trim(),
  };

  if (modelId) {
    data.modelId = modelId;
  }

  return request("/api/llama/chat", {
    method: "POST",
    data,
    timeout: 300000,
  });
}

export async function changeLlamaModel(modelId, deletePrevious = true) {
  if (!modelId) {
    throw new Error("modelId is required.");
  }

  return request("/api/llama/model", {
    method: "POST",
    data: {
      modelId,
      deletePrevious,
    },
    timeout: 300000,
  });
}

// ============================================================
// OCR
// ============================================================

export async function getOcrStatus(language = "eng") {
  return request(`/api/ocr/status?language=${encodeURIComponent(language)}`);
}

export async function recognizeImage(file, language = "eng") {
  if (!file) {
    throw new Error("Image file is required.");
  }

  const form = new FormData();

  form.append("image", file);

  form.append("language", language);

  return request("/api/ocr/recognize", {
    method: "POST",
    data: form,
  });
}

export async function screenshotOcr({
  askLlama = false,
  question = "What is visible on my screen?",
  includeImage = false,
  language = "eng",
} = {}) {
  return request("/api/ocr/screenshot", {
    method: "POST",
    data: {
      askLlama,
      question,
      includeImage,
      language,
    },
    timeout: 120000,
  });
}

// ============================================================
// VISION
// ============================================================

export async function getVisionStatus() {
  return request("/api/vision/status");
}

export async function analyzeImage(file, prompt = "Describe this image.") {
  if (!file) {
    throw new Error("Image file is required.");
  }

  const form = new FormData();

  form.append("image", file);

  form.append("prompt", prompt);

  return request("/api/vision/analyze", {
    method: "POST",
    data: form,
    timeout: 120000,
  });
}

export async function analyzeScreenshot(
  prompt = "Describe what is visible on my screen.",
) {
  return request("/api/vision/screenshot", {
    method: "POST",
    data: {
      prompt,
    },
    timeout: 120000,
  });
}

// ============================================================
// DEFAULT API OBJECT
// ============================================================

const api = {
  API_BASE_URL,
  WS_BASE_URL,

  getServerStatus,
  checkServer,

  getVoskStatus,
  transcribeAudio,

  getPiperStatus,
  warmupPiper,
  synthesizeSpeech,
  createAudioUrl,
  playAudioBlob,

  getLlamaStatus,
  chat,
  changeLlamaModel,

  getOcrStatus,
  recognizeImage,
  screenshotOcr,

  getVisionStatus,
  analyzeImage,
  analyzeScreenshot,
};

export default api;

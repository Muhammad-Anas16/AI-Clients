import { fetch as tauriFetch } from "@tauri-apps/plugin-http";

export const API_BASE_URL = "http://127.0.0.1:3000";

const buildUrl = (path) => `${API_BASE_URL}${path}`;

const parseJsonSafe = async (response) => {
  const text = await response.text();

  if (!text) {
    return null;
  }

  try {
    return JSON.parse(text);
  } catch {
    return text;
  }
};

const createRequestError = (response, payload) => {
  const message =
    payload?.message ||
    payload?.error ||
    (typeof payload === "string" ? payload : "") ||
    `HTTP ${response.status} ${response.statusText}`;

  return new Error(message);
};

const request = async (
  path,
  {
    method = "GET",
    body = undefined,
    headers = {},
    responseType = "json",
    connectTimeout = 10000,
  } = {},
) => {
  const requestHeaders = { ...headers };
  let requestBody = body;

  if (
    body !== undefined &&
    body !== null &&
    !(body instanceof FormData) &&
    typeof body !== "string" &&
    !(body instanceof Blob) &&
    !(body instanceof ArrayBuffer)
  ) {
    requestHeaders["Content-Type"] = "application/json";
    requestBody = JSON.stringify(body);
  }

  const response = await tauriFetch(buildUrl(path), {
    method,
    headers: requestHeaders,
    body: requestBody,
    connectTimeout,
  });

  if (!response.ok) {
    const payload = await parseJsonSafe(response);
    throw createRequestError(response, payload);
  }

  if (responseType === "audio") {
    const buffer = await response.arrayBuffer();
    const contentType =
      response.headers.get("content-type") || "audio/wav";

    return {
      blob: new Blob([buffer], { type: contentType }),
      contentType,
      buffer,
      response,
    };
  }

  if (responseType === "text") {
    return response.text();
  }

  return parseJsonSafe(response);
};

export const getServerStatus = () => request("/api/status");

export const getModelCatalog = () => request("/api/models");

export const checkServer = async () => {
  try {
    await getServerStatus();
    return true;
  } catch {
    return false;
  }
};

export const getVoskStatus = () => request("/api/vosk/status");

export const transcribeAudio = (file, modelId = "english") => {
  if (!file) {
    throw new Error("Audio file is required.");
  }

  const form = new FormData();
  form.append("audio", file, file.name || "audio.wav");
  form.append("modelId", modelId);

  return request("/api/vosk/transcribe", {
    method: "POST",
    body: form,
    connectTimeout: 10000,
  });
};

export const transcribeWavBlob = (
  wavBlob,
  modelId = "english",
) => {
  if (!wavBlob) {
    throw new Error("WAV audio is required.");
  }

  const form = new FormData();

  form.append(
    "audio",
    new Blob([wavBlob], { type: "audio/wav" }),
    "jarvis.wav",
  );

  form.append("modelId", modelId);

  return request("/api/vosk/transcribe", {
    method: "POST",
    body: form,
    connectTimeout: 15000,
  });
};

export const getPiperStatus = () => request("/api/piper/status");

export const warmupPiper = (modelId = "auto") =>
  request("/api/piper/warmup", {
    method: "POST",
    body: {},
    connectTimeout: 60000,
  });

export const synthesizeSpeech = (
  text,
  modelId = "auto",
) => {
  const cleanText = String(text || "").trim();

  if (!cleanText) {
    throw new Error("Text is required.");
  }

  return request("/api/piper/synthesize", {
    method: "POST",
    body: {
      text: cleanText,
      modelId,
    },
    responseType: "audio",
    connectTimeout: 60000,
  });
};

export const getLlamaStatus = () => request("/api/llama/status");

export const chat = (
  prompt,
  modelId = undefined,
) => {
  const cleanPrompt = String(prompt || "").trim();

  if (!cleanPrompt) {
    throw new Error("Prompt is required.");
  }

  const body = {
    prompt: cleanPrompt,
  };

  if (modelId) {
    body.modelId = modelId;
  }

  return request("/api/llama/chat", {
    method: "POST",
    body,
    connectTimeout: 120000,
  });
};

export const changeLlamaModel = (
  modelId,
  deletePrevious = true,
) => {
  if (!modelId) {
    throw new Error("modelId is required.");
  }

  return request("/api/llama/model", {
    method: "POST",
    body: {
      modelId,
      deletePrevious,
    },
    connectTimeout: 120000,
  });
};

export const getOcrStatus = (language = "eng") =>
  request(
    `/api/ocr/status?language=${encodeURIComponent(language)}`,
  );

export const recognizeImage = (
  file,
  language = "eng",
) => {
  if (!file) {
    throw new Error("Image file is required.");
  }

  const form = new FormData();

  form.append("image", file, file.name || "image");
  form.append("language", language);

  return request("/api/ocr/recognize", {
    method: "POST",
    body: form,
    connectTimeout: 120000,
  });
};

export const screenshotOcr = ({
  askLlama = false,
  question = "What is visible on my screen?",
  includeImage = false,
  language = "eng",
} = {}) =>
  request("/api/ocr/screenshot", {
    method: "POST",
    body: {
      askLlama,
      question,
      includeImage,
      language,
    },
    connectTimeout: 120000,
  });

const api = {
  API_BASE_URL,
  getServerStatus,
  getModelCatalog,
  checkServer,
  getVoskStatus,
  transcribeAudio,
  transcribeWavBlob,
  getPiperStatus,
  warmupPiper,
  synthesizeSpeech,
  getLlamaStatus,
  chat,
  changeLlamaModel,
  getOcrStatus,
  recognizeImage,
  screenshotOcr,
};

export default api;

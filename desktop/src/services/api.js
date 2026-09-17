const API_BASE_URL = "http://127.0.0.1:3000";

// Small helper
async function request(path, options = {}) {
  const response = await fetch(`${API_BASE_URL}${path}`, {
    ...options,
    headers: {
      ...(options.body instanceof FormData
        ? {}
        : { "Content-Type": "application/json" }),
      ...(options.headers || {}),
    },
  });

  const contentType = response.headers.get("content-type") || "";

  // JSON response
  if (contentType.includes("application/json")) {
    const data = await response.json();

    if (!response.ok || data?.ok === false) {
      throw new Error(data?.message || `Request failed: ${response.status}`);
    }

    return data;
  }

  // Binary response, for example Piper WAV
  if (contentType.includes("audio/")) {
    if (!response.ok) {
      throw new Error(`Audio request failed: ${response.status}`);
    }

    return {
      ok: true,
      status: response.status,
      blob: await response.blob(),
      contentType,
    };
  }

  // Fallback text response
  const text = await response.text();

  if (!response.ok) {
    throw new Error(text || `Request failed: ${response.status}`);
  }

  return text;
}

// SERVER
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

// VOSK
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
    body: form,
  });
}

// PIPER TTS
export async function getPiperStatus() {
  return request("/api/piper/status");
}

export async function warmupPiper(modelId = "urdu") {
  return request("/api/piper/warmup", {
    method: "POST",
    body: JSON.stringify({
      modelId,
    }),
  });
}

export async function synthesizeSpeech(text, modelId = "auto") {
  if (!text || !text.trim()) {
    throw new Error("Text is required.");
  }

  return request("/api/piper/synthesize", {
    method: "POST",
    body: JSON.stringify({
      text: text.trim(),
      modelId,
    }),
  });
}

// Convert Piper Blob to playable browser URL
export function createAudioUrl(blob) {
  if (!(blob instanceof Blob)) {
    throw new Error("Invalid audio blob.");
  }

  return URL.createObjectURL(blob);
}

// Play Piper audio
export async function playAudioBlob(blob) {
  const url = createAudioUrl(blob);

  try {
    const audio = new Audio(url);

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

// LLAMA
export async function getLlamaStatus() {
  return request("/api/llama/status");
}

export async function chat(prompt, modelId) {
  if (!prompt || !prompt.trim()) {
    throw new Error("Prompt is required.");
  }

  const body = {
    prompt: prompt.trim(),
  };

  if (modelId) {
    body.modelId = modelId;
  }

  return request("/api/llama/chat", {
    method: "POST",
    body: JSON.stringify(body),
  });
}

export async function changeLlamaModel(modelId, deletePrevious = true) {
  if (!modelId) {
    throw new Error("modelId is required.");
  }

  return request("/api/llama/model", {
    method: "POST",
    body: JSON.stringify({
      modelId,
      deletePrevious,
    }),
  });
}

// TESSERACT OCR
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
    body: form,
  });
}

// PC SCREENSHOT + OCR
export async function screenshotOcr({
  askLlama = false,
  question = "What is visible on my screen?",
  includeImage = false,
  language = "eng",
} = {}) {
  return request("/api/ocr/screenshot", {
    method: "POST",
    body: JSON.stringify({
      askLlama,
      question,
      includeImage,
      language,
    }),
  });
}

// FUTURE VISION API
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
    body: form,
  });
}

export async function analyzeScreenshot(
  prompt = "Describe what is visible on my screen.",
) {
  return request("/api/vision/screenshot", {
    method: "POST",
    body: JSON.stringify({
      prompt,
    }),
  });
}

const api = {
  // Server
  getServerStatus,
  checkServer,

  // Vosk
  getVoskStatus,
  transcribeAudio,

  // Piper
  getPiperStatus,
  warmupPiper,
  synthesizeSpeech,
  createAudioUrl,
  playAudioBlob,

  // LLaMA
  getLlamaStatus,
  chat,
  changeLlamaModel,

  // OCR
  getOcrStatus,
  recognizeImage,
  screenshotOcr,

  // Vision
  getVisionStatus,
  analyzeImage,
  analyzeScreenshot,
};

export default api;

import axios from "axios";

// SERVER CONFIG
// Agar AI Server isi PC par chal raha hai:
export const API_BASE_URL = "http://127.0.0.1:3000";

export const WS_BASE_URL = API_BASE_URL.replace(/^http/, "ws");

// Axios client
const http = axios.create({
  baseURL: API_BASE_URL,
  timeout: 120000,
});

// ERROR HELPER
async function getAxiosErrorMessage(error) {
  const status = error?.response?.status;
  const data = error?.response?.data;

  // Kabhi server error blob ki form mein aa sakta hai.
  if (data instanceof Blob) {
    try {
      const text = await data.text();

      if (text) {
        try {
          const json = JSON.parse(text);

          return json?.message || json?.error || text;
        } catch {
          return text;
        }
      }
    } catch {
      // Ignore blob parsing errors.
    }
  }

  if (data?.message) {
    return data.message;
  }

  if (data?.error) {
    return data.error;
  }

  if (typeof data === "string" && data.trim()) {
    return data;
  }

  if (error?.code === "ECONNABORTED") {
    return "Server request timed out.";
  }

  if (!error?.response) {
    return (
      "Cannot connect to JARVIS server. " +
      "Check that the server is running and the IP/port is correct."
    );
  }

  return error?.message || `Request failed: ${status || "unknown"}`;
}

// BASIC AXIOS REQUEST
async function request(path, options = {}) {
  const { method = "GET", body, headers = {}, responseType = "json" } = options;

  const isFormData =
    typeof FormData !== "undefined" && body instanceof FormData;

  try {
    const response = await http.request({
      url: path,
      method,

      // Axios automatically handles objects as JSON.
      data: body,

      headers: {
        // IMPORTANT:
        // FormData ke case mein Content-Type manually set nahi karna.
        // Browser boundary khud add karega.
        ...(isFormData
          ? {}
          : {
              "Content-Type": "application/json",
            }),

        ...(headers || {}),
      },

      responseType,
    });

    const contentType = response.headers?.["content-type"] || "";

    // PIPER AUDIO
    if (responseType === "blob" || contentType.includes("audio/")) {
      if (!(response.data instanceof Blob)) {
        throw new Error("Server returned invalid audio data.");
      }

      return {
        ok: true,
        status: response.status,
        blob: response.data,
        contentType,
      };
    }

    // ========================================================
    // JSON RESPONSE
    // ========================================================

    const data = response.data;

    if (data?.ok === false) {
      throw new Error(data?.message || "Server returned an error.");
    }

    return data;
  } catch (error) {
    // Agar hamne khud Error banaya hai.
    if (error instanceof Error && !error.response && error.message) {
      throw error;
    }

    throw new Error(await getAxiosErrorMessage(error));
  }
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

    body: {
      modelId,
    },
  });
}

export async function synthesizeSpeech(text, modelId = "auto") {
  if (!text || !text.trim()) {
    throw new Error("Text is required.");
  }

  return request("/api/piper/synthesize", {
    method: "POST",

    body: {
      text: text.trim(),
      modelId,
    },

    // Piper audio/wav response
    responseType: "blob",
  });
}

// PIPER AUDIO PLAYBACK
export function createAudioUrl(blob) {
  if (!(blob instanceof Blob)) {
    throw new Error("Invalid audio blob.");
  }

  return URL.createObjectURL(blob);
}

export async function playAudioBlob(blob) {
  const url = createAudioUrl(blob);

  try {
    const audio = new Audio(url);

    await audio.play();

    audio.addEventListener(
      "ended",
      () => {
        URL.revokeObjectURL(url);
      },
      {
        once: true,
      },
    );

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
    body,
  });
}

export async function changeLlamaModel(modelId, deletePrevious = true) {
  if (!modelId) {
    throw new Error("modelId is required.");
  }

  return request("/api/llama/model", {
    method: "POST",

    body: {
      modelId,
      deletePrevious,
    },
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

// SCREENSHOT + OCR
export async function screenshotOcr({
  askLlama = false,
  question = "What is visible on my screen?",
  includeImage = false,
  language = "eng",
} = {}) {
  return request("/api/ocr/screenshot", {
    method: "POST",

    body: {
      askLlama,
      question,
      includeImage,
      language,
    },
  });
}

// FUTURE VISION
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

    body: {
      prompt,
    },
  });
}

// REALTIME VOSK / WAKE WORD
let realtimeSocket = null;

let realtimeHandlers = {
  onConnecting: null,
  onReady: null,
  onWake: null,
  onPartial: null,
  onCommand: null,
  onError: null,
  onClose: null,
  onPong: null,
};

export function connectRealtimeVoice(handlers = {}) {
  // Close old socket
  disconnectRealtimeVoice();

  realtimeHandlers = {
    ...realtimeHandlers,
    ...handlers,
  };

  return new Promise((resolve, reject) => {
    const socket = new WebSocket(`${WS_BASE_URL}/ws/voice`);

    realtimeSocket = socket;

    socket.binaryType = "arraybuffer";

    // ------------------------------------------------------
    // OPEN
    socket.onopen = () => {
      console.log("[JARVIS] Realtime voice connected");

      resolve(socket);
    };

    // MESSAGE
    socket.onmessage = (event) => {
      try {
        const message = JSON.parse(event.data);

        handleRealtimeMessage(message);
      } catch (error) {
        console.error("[JARVIS] Invalid realtime message:", error);
      }
    };

    // ERROR
    socket.onerror = (event) => {
      console.error("[JARVIS] Realtime voice error:", event);

      if (realtimeHandlers.onError) {
        realtimeHandlers.onError("Realtime voice connection error.");
      }

      reject(new Error("Realtime voice connection failed."));
    };

    // CLOSE
    socket.onclose = (event) => {
      console.log("[JARVIS] Realtime voice disconnected", event.code);

      if (realtimeHandlers.onClose) {
        realtimeHandlers.onClose(event);
      }

      realtimeSocket = null;
    };
  });
}

// REALTIME SERVER MESSAGE HANDLER
function handleRealtimeMessage(message) {
  switch (message.type) {
    case "voice:connecting":
      if (realtimeHandlers.onConnecting) {
        realtimeHandlers.onConnecting(message);
      }

      break;

    case "voice:ready":
      if (realtimeHandlers.onReady) {
        realtimeHandlers.onReady(message);
      }

      break;

    case "voice:wake":
      if (realtimeHandlers.onWake) {
        realtimeHandlers.onWake(message.text || "jarvis");
      }

      break;

    case "voice:partial":
      if (realtimeHandlers.onPartial) {
        realtimeHandlers.onPartial(message.text || "");
      }

      break;

    case "voice:command":
      if (realtimeHandlers.onCommand) {
        realtimeHandlers.onCommand(message.text || "");
      }

      break;

    case "voice:error":
      if (realtimeHandlers.onError) {
        realtimeHandlers.onError(message.message || "Realtime Vosk error.");
      }

      break;

    case "pong":
      if (realtimeHandlers.onPong) {
        realtimeHandlers.onPong(message);
      }

      break;

    case "voice:state":
      console.log("[JARVIS] Voice state:", message.state);

      break;

    default:
      console.log("[JARVIS] Unknown voice event:", message);
  }
}

// SEND REALTIME AUDIO
export function sendRealtimeAudio(audioChunk) {
  if (!realtimeSocket) {
    throw new Error("Realtime voice is not connected.");
  }

  if (realtimeSocket.readyState !== WebSocket.OPEN) {
    throw new Error("Realtime voice socket is not open.");
  }

  // Blob
  if (typeof Blob !== "undefined" && audioChunk instanceof Blob) {
    audioChunk.arrayBuffer().then((buffer) => {
      if (realtimeSocket?.readyState === WebSocket.OPEN) {
        realtimeSocket.send(buffer);
      }
    });

    return;
  }

  // Uint8Array
  if (audioChunk instanceof Uint8Array) {
    realtimeSocket.send(audioChunk.buffer);

    return;
  }

  // Int16Array
  if (audioChunk instanceof Int16Array) {
    realtimeSocket.send(audioChunk.buffer);

    return;
  }

  // ArrayBuffer
  if (audioChunk instanceof ArrayBuffer) {
    realtimeSocket.send(audioChunk);

    return;
  }

  throw new Error("Unsupported realtime audio chunk type.");
}

// REALTIME PING
export function pingRealtimeVoice() {
  if (!realtimeSocket || realtimeSocket.readyState !== WebSocket.OPEN) {
    return false;
  }

  realtimeSocket.send(
    JSON.stringify({
      type: "ping",
    }),
  );

  return true;
}

// STOP REALTIME SESSION
export function stopRealtimeVoice() {
  if (!realtimeSocket || realtimeSocket.readyState !== WebSocket.OPEN) {
    return;
  }

  realtimeSocket.send(
    JSON.stringify({
      type: "stop",
    }),
  );
}

// DISCONNECT REALTIME
export function disconnectRealtimeVoice() {
  if (!realtimeSocket) {
    return;
  }

  try {
    if (realtimeSocket.readyState === WebSocket.OPEN) {
      realtimeSocket.send(
        JSON.stringify({
          type: "stop",
        }),
      );
    }
  } catch {}

  try {
    realtimeSocket.close();
  } catch {}

  realtimeSocket = null;
}

// REALTIME STATUS
export function isRealtimeVoiceConnected() {
  return (
    realtimeSocket !== null && realtimeSocket.readyState === WebSocket.OPEN
  );
}

// API OBJECT
const api = {
  API_BASE_URL,
  WS_BASE_URL,

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

  // Realtime Vosk
  connectRealtimeVoice,
  sendRealtimeAudio,
  pingRealtimeVoice,
  stopRealtimeVoice,
  disconnectRealtimeVoice,
  isRealtimeVoiceConnected,
};

export default api;

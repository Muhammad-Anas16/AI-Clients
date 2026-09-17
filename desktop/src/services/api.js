// const API_BASE_URL = "http://127.0.0.1:3000";

// // Small helper
// async function request(path, options = {}) {
//   const response = await fetch(`${API_BASE_URL}${path}`, {
//     ...options,
//     headers: {
//       ...(options.body instanceof FormData
//         ? {}
//         : { "Content-Type": "application/json" }),
//       ...(options.headers || {}),
//     },
//   });

//   const contentType = response.headers.get("content-type") || "";

//   // JSON response
//   if (contentType.includes("application/json")) {
//     const data = await response.json();

//     if (!response.ok || data?.ok === false) {
//       throw new Error(data?.message || `Request failed: ${response.status}`);
//     }

//     return data;
//   }

//   // Binary response, for example Piper WAV
//   if (contentType.includes("audio/")) {
//     if (!response.ok) {
//       throw new Error(`Audio request failed: ${response.status}`);
//     }

//     return {
//       ok: true,
//       status: response.status,
//       blob: await response.blob(),
//       contentType,
//     };
//   }

//   // Fallback text response
//   const text = await response.text();

//   if (!response.ok) {
//     throw new Error(text || `Request failed: ${response.status}`);
//   }

//   return text;
// }

// // SERVER
// export async function getServerStatus() {
//   return request("/api/status");
// }

// export async function checkServer() {
//   try {
//     await getServerStatus();
//     return true;
//   } catch {
//     return false;
//   }
// }

// // VOSK
// export async function getVoskStatus() {
//   return request("/api/vosk/status");
// }

// export async function transcribeAudio(file, modelId = "english") {
//   if (!file) {
//     throw new Error("Audio file is required.");
//   }

//   const form = new FormData();

//   form.append("audio", file);

//   if (modelId) {
//     form.append("modelId", modelId);
//   }

//   return request("/api/vosk/transcribe", {
//     method: "POST",
//     body: form,
//   });
// }

// // PIPER TTS
// export async function getPiperStatus() {
//   return request("/api/piper/status");
// }

// export async function warmupPiper(modelId = "urdu") {
//   return request("/api/piper/warmup", {
//     method: "POST",
//     body: JSON.stringify({
//       modelId,
//     }),
//   });
// }

// export async function synthesizeSpeech(text, modelId = "auto") {
//   if (!text || !text.trim()) {
//     throw new Error("Text is required.");
//   }

//   return request("/api/piper/synthesize", {
//     method: "POST",
//     body: JSON.stringify({
//       text: text.trim(),
//       modelId,
//     }),
//   });
// }

// // Convert Piper Blob to playable browser URL
// export function createAudioUrl(blob) {
//   if (!(blob instanceof Blob)) {
//     throw new Error("Invalid audio blob.");
//   }

//   return URL.createObjectURL(blob);
// }

// // Play Piper audio
// export async function playAudioBlob(blob) {
//   const url = createAudioUrl(blob);

//   try {
//     const audio = new Audio(url);

//     await audio.play();

//     audio.addEventListener("ended", () => URL.revokeObjectURL(url), {
//       once: true,
//     });

//     return audio;
//   } catch (error) {
//     URL.revokeObjectURL(url);
//     throw error;
//   }
// }

// // LLAMA
// export async function getLlamaStatus() {
//   return request("/api/llama/status");
// }

// export async function chat(prompt, modelId) {
//   if (!prompt || !prompt.trim()) {
//     throw new Error("Prompt is required.");
//   }

//   const body = {
//     prompt: prompt.trim(),
//   };

//   if (modelId) {
//     body.modelId = modelId;
//   }

//   return request("/api/llama/chat", {
//     method: "POST",
//     body: JSON.stringify(body),
//   });
// }

// export async function changeLlamaModel(modelId, deletePrevious = true) {
//   if (!modelId) {
//     throw new Error("modelId is required.");
//   }

//   return request("/api/llama/model", {
//     method: "POST",
//     body: JSON.stringify({
//       modelId,
//       deletePrevious,
//     }),
//   });
// }

// // TESSERACT OCR
// export async function getOcrStatus(language = "eng") {
//   return request(`/api/ocr/status?language=${encodeURIComponent(language)}`);
// }

// export async function recognizeImage(file, language = "eng") {
//   if (!file) {
//     throw new Error("Image file is required.");
//   }

//   const form = new FormData();

//   form.append("image", file);
//   form.append("language", language);

//   return request("/api/ocr/recognize", {
//     method: "POST",
//     body: form,
//   });
// }

// // PC SCREENSHOT + OCR
// export async function screenshotOcr({
//   askLlama = false,
//   question = "What is visible on my screen?",
//   includeImage = false,
//   language = "eng",
// } = {}) {
//   return request("/api/ocr/screenshot", {
//     method: "POST",
//     body: JSON.stringify({
//       askLlama,
//       question,
//       includeImage,
//       language,
//     }),
//   });
// }

// // FUTURE VISION API
// export async function getVisionStatus() {
//   return request("/api/vision/status");
// }

// export async function analyzeImage(file, prompt = "Describe this image.") {
//   if (!file) {
//     throw new Error("Image file is required.");
//   }

//   const form = new FormData();

//   form.append("image", file);
//   form.append("prompt", prompt);

//   return request("/api/vision/analyze", {
//     method: "POST",
//     body: form,
//   });
// }

// export async function analyzeScreenshot(
//   prompt = "Describe what is visible on my screen.",
// ) {
//   return request("/api/vision/screenshot", {
//     method: "POST",
//     body: JSON.stringify({
//       prompt,
//     }),
//   });
// }

// const api = {
//   // Server
//   getServerStatus,
//   checkServer,

//   // Vosk
//   getVoskStatus,
//   transcribeAudio,

//   // Piper
//   getPiperStatus,
//   warmupPiper,
//   synthesizeSpeech,
//   createAudioUrl,
//   playAudioBlob,

//   // LLaMA
//   getLlamaStatus,
//   chat,
//   changeLlamaModel,

//   // OCR
//   getOcrStatus,
//   recognizeImage,
//   screenshotOcr,

//   // Vision
//   getVisionStatus,
//   analyzeImage,
//   analyzeScreenshot,
// };

// export default api;

// Same PC par JARVIS server chal raha hai:
const API_BASE_URL = "http://127.0.0.1:3000";

// Realtime Vosk WebSocket
const WS_BASE_URL = "ws://127.0.0.1:3000";

// BASIC HTTP REQUEST
async function request(path, options = {}) {
  const response = await fetch(`${API_BASE_URL}${path}`, {
    ...options,

    headers: {
      ...(options.body instanceof FormData
        ? {}
        : {
            "Content-Type": "application/json",
          }),

      ...(options.headers || {}),
    },
  });

  const contentType = response.headers.get("content-type") || "";

  if (contentType.includes("application/json")) {
    const data = await response.json();

    if (!response.ok || data?.ok === false) {
      throw new Error(data?.message || `Request failed: ${response.status}`);
    }

    return data;
  }

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

// SCREENSHOT + OCR
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
    body: JSON.stringify({
      prompt,
    }),
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

    socket.onopen = () => {
      console.log("[JARVIS] Realtime voice connected");

      resolve(socket);
    };

    socket.onmessage = (event) => {
      try {
        const message = JSON.parse(event.data);

        handleRealtimeMessage(message);
      } catch (error) {
        console.error("[JARVIS] Invalid realtime message:", error);
      }
    };

    socket.onerror = (event) => {
      console.error("[JARVIS] Realtime voice error:", event);

      if (realtimeHandlers.onError) {
        realtimeHandlers.onError("Realtime voice connection error.");
      }

      reject(new Error("Realtime voice connection failed."));
    };

    socket.onclose = (event) => {
      console.log("[JARVIS] Realtime voice disconnected", event.code);

      if (realtimeHandlers.onClose) {
        realtimeHandlers.onClose(event);
      }

      realtimeSocket = null;
    };
  });
}

// Handle server events
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
      // Optional state handling
      console.log("[JARVIS] Voice state:", message.state);
      break;

    default:
      console.log("[JARVIS] Unknown voice event:", message);
  }
}
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
      realtimeSocket.send(buffer);
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

  // Realtime Vosk
  connectRealtimeVoice,
  sendRealtimeAudio,
  pingRealtimeVoice,
  stopRealtimeVoice,
  disconnectRealtimeVoice,
  isRealtimeVoiceConnected,
};

export default api;

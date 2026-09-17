// C:\Users\OFFICE-PC2\Desktop\AI-client\desktop\src\services\realtimeVoice.js

import { invoke } from "@tauri-apps/api/core";
import { listen } from "@tauri-apps/api/event";

import api from "./api.js";

// CONFIG
const WS_URL = "ws://127.0.0.1:3000/ws/voice";

// STATE
let socket = null;

let unlistenMic = null;
let unlistenMicError = null;

let running = false;
let processing = false;
let currentAudio = null;
let currentHandlers = {};

// BASE64 -> ARRAY BUFFER
function base64ToArrayBuffer(base64) {
  const binary = atob(base64);

  const bytes = new Uint8Array(binary.length);

  for (let i = 0; i < binary.length; i += 1) {
    bytes[i] = binary.charCodeAt(i);
  }

  return bytes.buffer;
}

// ============================================================
// SEND EVENT TO APP
// ============================================================

function emitEvent(event) {
  if (currentHandlers && typeof currentHandlers.onEvent === "function") {
    currentHandlers.onEvent(event);
  }
}

// PLAY JARVIS AUDIO
function playAndWait(blob) {
  return new Promise((resolve, reject) => {
    const url = URL.createObjectURL(blob);

    const audio = new Audio(url);

    currentAudio = audio;

    let finished = false;

    function cleanup() {
      if (finished) return;

      finished = true;

      try {
        URL.revokeObjectURL(url);
      } catch {}

      currentAudio = null;
    }

    audio.onended = () => {
      cleanup();
      resolve();
    };

    audio.onerror = () => {
      cleanup();

      reject(new Error("Could not play JARVIS audio."));
    };

    audio.onpause = () => {
      if (!running) {
        cleanup();
        resolve();
      }
    };

    audio.play().catch((error) => {
      cleanup();
      reject(error);
    });
  });
}

// STOP CURRENT AUDIO
function stopCurrentAudio() {
  if (!currentAudio) {
    return;
  }

  try {
    currentAudio.pause();
  } catch {}

  try {
    currentAudio.currentTime = 0;
  } catch {}

  currentAudio = null;
}

// RUN COMMAND AFTER WAKE WORD
async function runCommand(command) {
  if (!running) {
    return;
  }

  if (processing) {
    return;
  }

  const cleanCommand = String(command || "").trim();

  if (!cleanCommand) {
    return;
  }

  processing = true;

  // Stop microphone while AI is thinking.
  await invoke("stop_microphone").catch(() => {});

  emitEvent({
    type: "state",
    state: "thinking",
  });

  emitEvent({
    type: "command",
    text: cleanCommand,
  });

  try {
    // LLaMA
    const response = await api.chat(cleanCommand);

    const answer = response?.data?.answer || "";

    emitEvent({
      type: "answer",
      text: answer,
    });

    if (!answer) {
      throw new Error("LLaMA returned an empty answer.");
    }

    // Piper
    emitEvent({
      type: "state",
      state: "speaking",
    });

    const audio = await api.synthesizeSpeech(answer, "auto");

    if (!audio?.blob) {
      throw new Error("Piper did not return audio.");
    }

    await playAndWait(audio.blob);
  } catch (error) {
    emitEvent({
      type: "error",
      message: error?.message || "JARVIS command failed.",
    });
  } finally {
    processing = false;

    if (!running) {
      return;
    }

    // Start listening again automatically.
    emitEvent({
      type: "state",
      state: "waiting_for_wake_word",
    });

    await startNativeMicrophone();
  }
}

// START NATIVE MICROPHONE
async function startNativeMicrophone() {
  if (!running) {
    return;
  }

  try {
    await invoke("start_microphone");
  } catch (error) {
    emitEvent({
      type: "error",
      message: error?.toString() || "Could not start microphone.",
    });
  }
}

// STOP NATIVE MICROPHONE
async function stopNativeMicrophone() {
  try {
    await invoke("stop_microphone");
  } catch {}
}

// CONNECT REALTIME VOICE
export async function startRealtimeVoice(onEvent = () => {}) {
  // Already running
  if (running) {
    emitEvent({
      type: "state",
      state: "waiting_for_wake_word",
    });

    return;
  }

  currentHandlers = {
    onEvent,
  };

  running = true;
  processing = false;

  emitEvent({
    type: "state",
    state: "connecting_voice",
  });

  // Create WebSocket
  socket = new WebSocket(WS_URL);

  socket.binaryType = "arraybuffer";
  // WebSocket OPEN
  socket.onopen = async () => {
    if (!running) {
      return;
    }

    emitEvent({
      type: "state",
      state: "connecting_voice",
    });

    try {
      // Listen for PCM microphone chunks
      unlistenMic = await listen("mic:pcm", (event) => {
        if (!running) {
          return;
        }

        if (processing) {
          return;
        }

        if (!socket) {
          return;
        }

        if (socket.readyState !== WebSocket.OPEN) {
          return;
        }

        const payload = event?.payload;

        if (!payload?.data) {
          return;
        }

        try {
          const pcm = base64ToArrayBuffer(payload.data);

          socket.send(pcm);
        } catch (error) {
          emitEvent({
            type: "error",
            message: error?.message || "Could not send microphone audio.",
          });
        }
      });

      // Microphone errors
      unlistenMicError = await listen("mic:error", (event) => {
        emitEvent({
          type: "error",
          message: event?.payload?.message || "Microphone error.",
        });
      });

      // Start native microphone
      await startNativeMicrophone();
    } catch (error) {
      emitEvent({
        type: "error",
        message:
          error?.message ||
          error?.toString() ||
          "Could not start realtime microphone.",
      });

      await stopRealtimeVoice();
    }
  };

  // WebSocket MESSAGE
  socket.onmessage = async (event) => {
    if (!running) {
      return;
    }

    try {
      const message =
        typeof event.data === "string" ? JSON.parse(event.data) : null;

      if (!message) {
        return;
      }

      // Server ready
      if (message.type === "voice:ready") {
        emitEvent({
          type: "state",
          state: "waiting_for_wake_word",
        });

        return;
      }
      // Wake word detected
      if (message.type === "voice:wake") {
        emitEvent({
          type: "state",
          state: "wake_detected",
        });

        emitEvent({
          type: "wake",
          text: message.text || "Jarvis",
        });

        return;
      }
      // Partial Vosk text
      if (message.type === "voice:partial") {
        emitEvent({
          type: "partial",
          text: message.text || "",
        });

        return;
      }
      // Final command
      if (message.type === "voice:command") {
        await runCommand(message.text || "");

        return;
      }

      // Voice error
      if (message.type === "voice:error") {
        emitEvent({
          type: "error",
          message: message.message || "Realtime Vosk error.",
        });

        return;
      }
      // Server state
      if (message.type === "voice:state") {
        emitEvent({
          type: "state",
          state: message.state || "unknown",
        });

        return;
      }

      // Ping response
      if (message.type === "pong") {
        emitEvent({
          type: "pong",
        });
      }
    } catch (error) {
      emitEvent({
        type: "error",
        message: error?.message || "Invalid realtime server message.",
      });
    }
  };

  // WebSocket ERROR
  socket.onerror = () => {
    emitEvent({
      type: "error",
      message: "Realtime voice WebSocket connection failed.",
    });
  };

  // WebSocket CLOSE
  socket.onclose = () => {
    if (!running) {
      return;
    }

    emitEvent({
      type: "error",
      message: "Realtime voice connection closed.",
    });

    emitEvent({
      type: "state",
      state: "error",
    });
  };
}

// STOP EVERYTHING
export async function stopRealtimeVoice() {
  running = false;
  processing = false;

  // Stop audio
  stopCurrentAudio();

  // Stop microphone
  await stopNativeMicrophone();

  // Remove Tauri microphone listeners
  if (unlistenMic) {
    try {
      await unlistenMic();
    } catch {}

    unlistenMic = null;
  }

  if (unlistenMicError) {
    try {
      await unlistenMicError();
    } catch {}

    unlistenMicError = null;
  }

  // Close websocket
  if (socket) {
    try {
      if (socket.readyState === WebSocket.OPEN) {
        socket.send(
          JSON.stringify({
            type: "stop",
          }),
        );
      }
    } catch {}

    try {
      socket.close();
    } catch {}

    socket = null;
  }

  currentHandlers = {};
}

// CONNECTION STATUS
export function isRealtimeVoiceRunning() {
  return running;
}

export function isRealtimeVoiceProcessing() {
  return processing;
}

// MANUAL PING
export function pingRealtimeVoice() {
  if (!socket) {
    return false;
  }

  if (socket.readyState !== WebSocket.OPEN) {
    return false;
  }

  socket.send(
    JSON.stringify({
      type: "ping",
    }),
  );

  return true;
}

const realtimeVoice = {
  startRealtimeVoice,
  stopRealtimeVoice,
  isRealtimeVoiceRunning,
  isRealtimeVoiceProcessing,
  pingRealtimeVoice,
};

export default realtimeVoice;

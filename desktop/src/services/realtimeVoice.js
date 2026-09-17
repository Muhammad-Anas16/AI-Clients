import api, { WS_BASE_URL } from "./api.js";

// ============================================================
// REALTIME VOICE
// ============================================================

const WS_URL = `${WS_BASE_URL}/ws/voice`;

const TARGET_SAMPLE_RATE = 16000;

let socket = null;

let audioContext = null;
let mediaStream = null;
let mediaSource = null;
let processor = null;
let silentGain = null;

let running = false;
let processing = false;

let currentAudio = null;

let currentHandlers = {};

// ============================================================
// EVENTS
// ============================================================

function emitEvent(event) {
  if (typeof currentHandlers.onEvent === "function") {
    currentHandlers.onEvent(event);
  }
}

// ============================================================
// FLOAT -> PCM16
// ============================================================

function floatTo16BitPCM(float32) {
  const output = new Int16Array(float32.length);

  for (let i = 0; i < float32.length; i += 1) {
    const sample = Math.max(-1, Math.min(1, float32[i]));

    output[i] = sample < 0 ? sample * 0x8000 : sample * 0x7fff;
  }

  return output;
}

// ============================================================
// DOWNSAMPLE
// ============================================================

function downsampleBuffer(buffer, inputSampleRate, outputSampleRate) {
  if (inputSampleRate === outputSampleRate) {
    return buffer;
  }

  if (outputSampleRate > inputSampleRate) {
    throw new Error(
      `Microphone sample rate ${inputSampleRate}Hz is below required ${outputSampleRate}Hz.`,
    );
  }

  const ratio = inputSampleRate / outputSampleRate;

  const newLength = Math.round(buffer.length / ratio);

  const result = new Float32Array(newLength);

  let resultOffset = 0;
  let bufferOffset = 0;

  while (resultOffset < result.length) {
    const nextOffset = Math.round((resultOffset + 1) * ratio);

    let accumulator = 0;
    let count = 0;

    for (let i = bufferOffset; i < nextOffset && i < buffer.length; i += 1) {
      accumulator += buffer[i];

      count += 1;
    }

    result[resultOffset] = count > 0 ? accumulator / count : 0;

    resultOffset += 1;
    bufferOffset = nextOffset;
  }

  return result;
}

// ============================================================
// SEND PCM
// ============================================================

function sendPcmFloat32(float32, inputSampleRate) {
  if (!socket || socket.readyState !== WebSocket.OPEN) {
    return;
  }

  try {
    const mono16k = downsampleBuffer(
      float32,
      inputSampleRate,
      TARGET_SAMPLE_RATE,
    );

    const pcm16 = floatTo16BitPCM(mono16k);

    socket.send(pcm16.buffer);
  } catch (error) {
    emitEvent({
      type: "error",
      message: error?.message || "Could not send microphone audio.",
    });
  }
}

// ============================================================
// AUDIO PLAYBACK
// ============================================================

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

function playAndWait(blob) {
  return new Promise((resolve, reject) => {
    const url = URL.createObjectURL(blob);

    const audio = new Audio(url);

    currentAudio = audio;

    let finished = false;

    function cleanup() {
      if (finished) {
        return;
      }

      finished = true;

      try {
        URL.revokeObjectURL(url);
      } catch {}

      if (currentAudio === audio) {
        currentAudio = null;
      }
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

// ============================================================
// MICROPHONE START
// ============================================================

async function startMicrophone() {
  if (!running) {
    return;
  }

  if (mediaStream) {
    return;
  }

  if (!navigator.mediaDevices || !navigator.mediaDevices.getUserMedia) {
    throw new Error("Microphone access is not available in this WebView.");
  }

  mediaStream = await navigator.mediaDevices.getUserMedia({
    audio: {
      channelCount: 1,
      echoCancellation: true,
      noiseSuppression: true,
      autoGainControl: true,
    },
    video: false,
  });

  audioContext = new AudioContext();

  if (audioContext.state === "suspended") {
    await audioContext.resume();
  }

  mediaSource = audioContext.createMediaStreamSource(mediaStream);

  processor = audioContext.createScriptProcessor(4096, 1, 1);

  processor.onaudioprocess = (event) => {
    if (!running || processing) {
      return;
    }

    const input = event.inputBuffer.getChannelData(0);

    const copy = new Float32Array(input.length);

    copy.set(input);

    sendPcmFloat32(copy, audioContext.sampleRate);
  };

  silentGain = audioContext.createGain();

  silentGain.gain.value = 0;

  mediaSource.connect(processor);

  processor.connect(silentGain);

  silentGain.connect(audioContext.destination);
}

// ============================================================
// MICROPHONE STOP
// ============================================================

async function stopMicrophone() {
  if (processor) {
    try {
      processor.disconnect();
    } catch {}

    processor.onaudioprocess = null;

    processor = null;
  }

  if (mediaSource) {
    try {
      mediaSource.disconnect();
    } catch {}

    mediaSource = null;
  }

  if (silentGain) {
    try {
      silentGain.disconnect();
    } catch {}

    silentGain = null;
  }

  if (mediaStream) {
    for (const track of mediaStream.getTracks()) {
      try {
        track.stop();
      } catch {}
    }

    mediaStream = null;
  }

  if (audioContext) {
    try {
      await audioContext.close();
    } catch {}

    audioContext = null;
  }
}

// ============================================================
// RUN COMMAND
// ============================================================

async function runCommand(command) {
  if (!running || processing) {
    return;
  }

  const cleanCommand = String(command || "").trim();

  if (!cleanCommand) {
    return;
  }

  processing = true;

  await stopMicrophone();

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

    if (!answer) {
      throw new Error("LLaMA returned an empty answer.");
    }

    emitEvent({
      type: "answer",
      text: answer,
    });

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

    try {
      await startMicrophone();

      emitEvent({
        type: "state",
        state: "waiting_for_wake_word",
      });
    } catch (error) {
      emitEvent({
        type: "error",
        message: error?.message || "Could not restart microphone.",
      });

      emitEvent({
        type: "state",
        state: "error",
      });
    }
  }
}

// ============================================================
// SERVER MESSAGE
// ============================================================

function handleServerMessage(message) {
  if (!message || typeof message !== "object") {
    return;
  }

  switch (message.type) {
    case "voice:connecting":
      emitEvent({
        type: "state",
        state: "connecting_voice",
      });
      break;

    case "voice:ready":
      emitEvent({
        type: "state",
        state: "waiting_for_wake_word",
      });
      break;

    case "voice:wake":
      emitEvent({
        type: "state",
        state: "wake_detected",
      });

      emitEvent({
        type: "wake",
        text: message.text || "Jarvis",
      });
      break;

    case "voice:partial":
      emitEvent({
        type: "partial",
        text: message.text || "",
      });
      break;

    case "voice:command":
      void runCommand(message.text || "");
      break;

    case "voice:error":
      emitEvent({
        type: "error",
        message: message.message || "Realtime Vosk error.",
      });
      break;

    case "voice:state":
      emitEvent({
        type: "state",
        state: message.state || "unknown",
      });
      break;

    case "pong":
      emitEvent({
        type: "pong",
      });
      break;

    default:
      console.log("[JARVIS] Unknown voice event:", message);
  }
}

// ============================================================
// CLOSE SOCKET
// ============================================================

function closeSocket() {
  if (!socket) {
    return;
  }

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

// ============================================================
// START
// ============================================================

async function startRealtimeVoice(onEvent = () => {}) {
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

  try {
    socket = new WebSocket(WS_URL);

    socket.binaryType = "arraybuffer";

    socket.onopen = async () => {
      if (!running) {
        return;
      }

      try {
        await startMicrophone();

        emitEvent({
          type: "state",
          state: "waiting_for_wake_word",
        });
      } catch (error) {
        emitEvent({
          type: "error",
          message: error?.message || "Could not start microphone.",
        });

        await stopRealtimeVoice();
      }
    };

    socket.onmessage = (event) => {
      try {
        if (typeof event.data !== "string") {
          return;
        }

        const message = JSON.parse(event.data);

        handleServerMessage(message);
      } catch (error) {
        emitEvent({
          type: "error",
          message: error?.message || "Invalid realtime server message.",
        });
      }
    };

    socket.onerror = () => {
      emitEvent({
        type: "error",
        message: `Realtime voice connection failed: ${WS_URL}`,
      });
    };

    socket.onclose = (event) => {
      if (!running) {
        return;
      }

      emitEvent({
        type: "error",
        message: `Realtime voice connection closed (code ${event.code}).`,
      });

      emitEvent({
        type: "state",
        state: "error",
      });
    };
  } catch (error) {
    running = false;
    currentHandlers = {};

    closeSocket();

    throw error;
  }
}

// ============================================================
// STOP
// ============================================================

async function stopRealtimeVoice() {
  running = false;
  processing = false;

  stopCurrentAudio();

  await stopMicrophone();

  closeSocket();

  currentHandlers = {};
}

// ============================================================
// STATUS
// ============================================================

function isRealtimeVoiceRunning() {
  return running;
}

function isRealtimeVoiceProcessing() {
  return processing;
}

// ============================================================
// PING
// ============================================================

function pingRealtimeVoice() {
  if (!socket || socket.readyState !== WebSocket.OPEN) {
    return false;
  }

  socket.send(
    JSON.stringify({
      type: "ping",
    }),
  );

  return true;
}

// ============================================================
// DEFAULT EXPORT
// ============================================================

const realtimeVoice = {
  startRealtimeVoice,
  stopRealtimeVoice,
  isRealtimeVoiceRunning,
  isRealtimeVoiceProcessing,
  pingRealtimeVoice,
};

export default realtimeVoice;

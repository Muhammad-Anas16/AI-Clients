import { invoke } from "@tauri-apps/api/core";
import { listen } from "@tauri-apps/api/event";

import api from "./api.js";

const SAMPLE_RATE = 16000;

const WAKE_WINDOW_SAMPLES = SAMPLE_RATE * 2;
const WAKE_OVERLAP_SAMPLES = Math.round(SAMPLE_RATE * 0.4);

const COMMAND_MAX_MS = 7000;
const COMMAND_MIN_MS = 500;
const SILENCE_MS = 700;
const RMS_THRESHOLD = 650;

let running = false;
let processing = false;
let wakeTranscribing = false;

let micUnlisten = null;
let micErrorUnlisten = null;

let wakeSamples = [];
let commandSamples = [];

let commandStarted = false;
let commandSilenceMs = 0;
let commandModeStartedAt = 0;

let currentAudio = null;
let currentMode = "wake";

let handlers = {
  onEvent: () => {},
};

const emitEvent = (event) => {
  handlers?.onEvent?.(event);
};

const resetWakeBuffer = () => {
  wakeSamples = [];
  wakeTranscribing = false;
};

const resetCommandBuffer = () => {
  commandSamples = [];
  commandStarted = false;
  commandSilenceMs = 0;
  commandModeStartedAt = 0;
};

const keepLastSamples = (samples, count) =>
  samples.length <= count
    ? samples
    : samples.slice(samples.length - count);

const calculateRms = (samples) => {
  if (!samples.length) {
    return 0;
  }

  let sum = 0;

  samples.forEach((sample) => {
    sum += sample * sample;
  });

  return Math.sqrt(sum / samples.length);
};

const writeString = (view, offset, value) => {
  for (let index = 0; index < value.length; index += 1) {
    view.setUint8(
      offset + index,
      value.charCodeAt(index),
    );
  }
};

const buildWavBlob = (
  samples,
  sampleRate = SAMPLE_RATE,
) => {
  const buffer = new ArrayBuffer(
    44 + samples.length * 2,
  );

  const view = new DataView(buffer);

  writeString(view, 0, "RIFF");
  view.setUint32(
    4,
    36 + samples.length * 2,
    true,
  );

  writeString(view, 8, "WAVE");

  writeString(view, 12, "fmt ");
  view.setUint32(16, 16, true);
  view.setUint16(20, 1, true);
  view.setUint16(22, 1, true);
  view.setUint32(24, sampleRate, true);
  view.setUint32(
    28,
    sampleRate * 2,
    true,
  );
  view.setUint16(32, 2, true);
  view.setUint16(34, 16, true);

  writeString(view, 36, "data");
  view.setUint32(
    40,
    samples.length * 2,
    true,
  );

  let offset = 44;

  samples.forEach((sample) => {
    view.setInt16(offset, sample, true);
    offset += 2;
  });

  return new Blob([buffer], {
    type: "audio/wav",
  });
};

const extractCommandAfterWake = (text) => {
  const cleanText = String(text || "").trim();

  const match = cleanText.match(
    /\bjarvis\b(.*)$/i,
  );

  if (!match) {
    return "";
  }

  return String(match[1] || "")
    .replace(/^[\s,:;-]+/, "")
    .trim();
};

const playAndWait = (blob) =>
  new Promise((resolve, reject) => {
    const url = URL.createObjectURL(blob);
    const audio = new Audio(url);

    currentAudio = audio;

    let finished = false;

    const cleanup = () => {
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
    };

    audio.onended = () => {
      cleanup();
      resolve();
    };

    audio.onerror = () => {
      cleanup();
      reject(new Error("JARVIS audio playback failed."));
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

const stopCurrentAudio = () => {
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
};

const startNativeMicrophone = async () => {
  if (!running) {
    return;
  }

  await invoke("start_microphone");
};

const stopNativeMicrophone = async () => {
  await invoke("stop_microphone").catch(() => {});
};

const enterCommandMode = () => {
  currentMode = "command";

  resetCommandBuffer();

  commandModeStartedAt = Date.now();

  emitEvent({
    type: "state",
    state: "waiting_for_command",
  });
};

const enterWakeMode = () => {
  currentMode = "wake";

  resetWakeBuffer();
  resetCommandBuffer();

  emitEvent({
    type: "state",
    state: "waiting_for_wake_word",
  });
};

const runCommand = async (command) => {
  const cleanCommand = String(command || "").trim();

  if (!running || processing || !cleanCommand) {
    return;
  }

  processing = true;
  currentMode = "idle";

  resetWakeBuffer();
  resetCommandBuffer();

  await stopNativeMicrophone();

  emitEvent({
    type: "state",
    state: "thinking",
  });

  emitEvent({
    type: "command",
    text: cleanCommand,
  });

  try {
    const response = await api.chat(cleanCommand);

    const answer = String(
      response?.data?.answer || "",
    ).trim();

    if (!answer) {
      throw new Error(
        "LLaMA returned an empty answer.",
      );
    }

    emitEvent({
      type: "answer",
      text: answer,
    });

    emitEvent({
      type: "state",
      state: "speaking",
    });

    const audio = await api.synthesizeSpeech(
      answer,
      "auto",
    );

    if (!audio?.blob) {
      throw new Error(
        "Piper did not return audio.",
      );
    }

    await playAndWait(audio.blob);
  } catch (error) {
    emitEvent({
      type: "error",
      message:
        error?.message ||
        String(error) ||
        "JARVIS command failed.",
    });
  } finally {
    processing = false;

    if (!running) {
      return;
    }

    enterWakeMode();

    try {
      await startNativeMicrophone();
    } catch (error) {
      emitEvent({
        type: "error",
        message:
          error?.message ||
          "Could not restart microphone.",
      });

      emitEvent({
        type: "state",
        state: "error",
      });
    }
  }
};

const transcribeWakeWindow = async () => {
  if (
    !running ||
    processing ||
    wakeTranscribing ||
    currentMode !== "wake" ||
    wakeSamples.length < WAKE_WINDOW_SAMPLES
  ) {
    return;
  }

  wakeTranscribing = true;

  const windowSamples = wakeSamples.slice(
    -WAKE_WINDOW_SAMPLES,
  );

  wakeSamples = keepLastSamples(
    wakeSamples,
    WAKE_OVERLAP_SAMPLES,
  );

  try {
    const response = await api.transcribeWavBlob(
      buildWavBlob(windowSamples),
      "english",
    );

    const text = String(
      response?.data?.text || "",
    ).trim();

    if (text) {
      emitEvent({
        type: "partial",
        text,
      });
    }

    if (!/\bjarvis\b/i.test(text)) {
      return;
    }

    emitEvent({
      type: "wake",
      text: "Jarvis",
    });

    const directCommand =
      extractCommandAfterWake(text);

    resetWakeBuffer();

    if (directCommand) {
      await runCommand(directCommand);
      return;
    }

    enterCommandMode();
  } catch (error) {
    emitEvent({
      type: "error",
      message:
        error?.message ||
        "Wake-word transcription failed.",
    });
  } finally {
    wakeTranscribing = false;

    if (
      running &&
      !processing &&
      currentMode === "wake" &&
      wakeSamples.length >= WAKE_WINDOW_SAMPLES
    ) {
      void transcribeWakeWindow();
    }
  }
};

const finishCommand = async () => {
  if (
    !running ||
    processing ||
    currentMode !== "command" ||
    !commandStarted
  ) {
    return;
  }

  const minimumSamples = Math.round(
    SAMPLE_RATE * (COMMAND_MIN_MS / 1000),
  );

  const samples = commandSamples.slice();

  resetCommandBuffer();

  if (samples.length < minimumSamples) {
    enterCommandMode();
    return;
  }

  processing = true;
  currentMode = "idle";

  await stopNativeMicrophone();

  emitEvent({
    type: "state",
    state: "transcribing_command",
  });

  try {
    const response = await api.transcribeWavBlob(
      buildWavBlob(samples),
      "english",
    );

    const text = String(
      response?.data?.text || "",
    ).trim();

    if (!text) {
      processing = false;

      if (running) {
        enterWakeMode();
        await startNativeMicrophone();
      }

      return;
    }

    processing = false;
    await runCommand(text);
  } catch (error) {
    processing = false;

    emitEvent({
      type: "error",
      message:
        error?.message ||
        "Command transcription failed.",
    });

    if (running) {
      enterWakeMode();
      await startNativeMicrophone();
    }
  }
};

const handleCommandChunk = (samples) => {
  const chunkMs =
    (samples.length / SAMPLE_RATE) * 1000;

  commandSamples.push(...samples);

  const rms = calculateRms(samples);

  if (rms >= RMS_THRESHOLD) {
    commandStarted = true;
    commandSilenceMs = 0;
  } else if (commandStarted) {
    commandSilenceMs += chunkMs;
  }

  const elapsedMs =
    Date.now() -
    (commandModeStartedAt || Date.now());

  if (
    commandStarted &&
    (commandSilenceMs >= SILENCE_MS ||
      elapsedMs >= COMMAND_MAX_MS)
  ) {
    void finishCommand();
    return;
  }

  if (
    !commandStarted &&
    elapsedMs >= COMMAND_MAX_MS
  ) {
    enterWakeMode();
  }
};

const handleMicPcm = (event) => {
  if (!running || processing) {
    return;
  }

  const base64 =
    event?.payload?.data || "";

  if (!base64) {
    return;
  }

  try {
    const binary = atob(base64);
    const bytes = new Uint8Array(
      binary.length,
    );

    for (
      let index = 0;
      index < binary.length;
      index += 1
    ) {
      bytes[index] =
        binary.charCodeAt(index);
    }

    const view = new DataView(
      bytes.buffer,
    );

    const samples = new Array(
      Math.floor(view.byteLength / 2),
    );

    for (
      let index = 0;
      index < samples.length;
      index += 1
    ) {
      samples[index] =
        view.getInt16(index * 2, true);
    }

    if (!samples.length) {
      return;
    }

    if (currentMode === "command") {
      handleCommandChunk(samples);
      return;
    }

    if (currentMode !== "wake") {
      return;
    }

    wakeSamples.push(...samples);

    const maxBuffer =
      WAKE_WINDOW_SAMPLES +
      WAKE_OVERLAP_SAMPLES;

    if (wakeSamples.length > maxBuffer) {
      wakeSamples = keepLastSamples(
        wakeSamples,
        maxBuffer,
      );
    }

    if (
      wakeSamples.length >=
        WAKE_WINDOW_SAMPLES &&
      !wakeTranscribing
    ) {
      void transcribeWakeWindow();
    }
  } catch (error) {
    emitEvent({
      type: "error",
      message:
        error?.message ||
        "Invalid microphone PCM chunk.",
    });
  }
};

export const startRealtimeVoice = async (
  onEvent = () => {},
) => {
  if (running) {
    emitEvent({
      type: "state",
      state: "waiting_for_wake_word",
    });

    return;
  }

  handlers = {
    onEvent,
  };

  running = true;
  processing = false;
  currentMode = "wake";

  resetWakeBuffer();
  resetCommandBuffer();

  emitEvent({
    type: "state",
    state: "starting",
  });

  try {
    micUnlisten = await listen(
      "mic:pcm",
      handleMicPcm,
    );

    micErrorUnlisten = await listen(
      "mic:error",
      (event) => {
        emitEvent({
          type: "error",
          message:
            event?.payload?.message ||
            "Microphone error.",
        });
      },
    );

    await startNativeMicrophone();

    emitEvent({
      type: "state",
      state: "waiting_for_wake_word",
    });
  } catch (error) {
    emitEvent({
      type: "error",
      message:
        error?.message ||
        String(error) ||
        "Could not start microphone.",
    });

    await stopRealtimeVoice();

    throw error;
  }
};

export const stopRealtimeVoice = async () => {
  running = false;
  processing = false;
  wakeTranscribing = false;
  currentMode = "wake";

  stopCurrentAudio();
  await stopNativeMicrophone();

  if (micUnlisten) {
    await micUnlisten().catch(() => {});
    micUnlisten = null;
  }

  if (micErrorUnlisten) {
    await micErrorUnlisten().catch(() => {});
    micErrorUnlisten = null;
  }

  resetWakeBuffer();
  resetCommandBuffer();

  handlers = {
    onEvent: () => {},
  };
};

export const isRealtimeVoiceRunning = () =>
  running;

export const isRealtimeVoiceProcessing = () =>
  processing;

export const pingRealtimeVoice = () => true;

export default {
  startRealtimeVoice,
  stopRealtimeVoice,
  isRealtimeVoiceRunning,
  isRealtimeVoiceProcessing,
  pingRealtimeVoice,
};

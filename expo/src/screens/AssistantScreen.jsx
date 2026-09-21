import { useCallback, useEffect, useRef, useState } from "react";

import {
  ActivityIndicator,
  Alert,
  Animated,
  Pressable,
  ScrollView,
  StyleSheet,
  Text,
  View,
} from "react-native";

import { router } from "expo-router";

import {
  AudioModule,
  setAudioModeAsync,
  useAudioStream,
  useAudioPlayer,
  useAudioPlayerStatus,
} from "expo-audio";

import { useSafeAreaInsets } from "react-native-safe-area-context";

import {
  VOICE_CONFIG,
  getRmsLevel,
  updateNoiseFloor,
  getSpeechThreshold,
  getStopThreshold,
  isVoiceLevel,
} from "../services/audio/voiceDetection";

import { pcmToWav } from "../services/audio/pcmToWav";

import {
  saveWavForVosk,
  saveWavForPlayback,
  deleteWavFile,
} from "../services/audio/playPcmRecording";

import {
  getIp,
  checkServerStatus,
  checkVoskStatus,
  checkPiperStatus,
  AskLlama,
  ListenPiper,
  transcribeAudio,
} from "../axios/api";

import { loadSettings } from "../services/setting/settingsService";

import WalkWordDetector from "../utils/walkWordDetector";

import {
  DEFAULT_WAKE_WORD,
  DEFAULT_USER_NAME,
  DEFAULT_SYSTEM_PROMPT,
  getWakeWordResponse,
  getProcessingResponse,
} from "../config/assistantConfig";

import { useTheme } from "../context/ThemeContext";

// ============================================================
// CONFIG
// ============================================================

const PRE_ROLL_BUFFERS = 5;

const POST_PLAYBACK_IGNORE_MS = 800;

const COMMAND_WAIT_MS = 12000;

const PIPER_SAMPLE_RATE = 22050;

// ============================================================
// HELPERS
// ============================================================

const getVoskText = (result) => {
  const text = result?.data?.text || result?.text || result?.transcript || "";

  return String(text).trim();
};

const getLlamaAnswer = (result) => {
  if (typeof result === "string") {
    return result.trim();
  }

  return String(
    result?.data?.answer ||
      result?.answer ||
      result?.data?.text ||
      result?.text ||
      "",
  ).trim();
};

const toUint8Array = (value) => {
  if (!value) {
    return null;
  }

  if (value instanceof Uint8Array) {
    return value;
  }

  if (value instanceof ArrayBuffer) {
    return new Uint8Array(value);
  }

  if (ArrayBuffer.isView(value)) {
    return new Uint8Array(value.buffer, value.byteOffset, value.byteLength);
  }

  if (value?.data) {
    return toUint8Array(value.data);
  }

  return null;
};

const isWav = (bytes) => {
  if (!bytes || bytes.length < 12) {
    return false;
  }

  return (
    String.fromCharCode(bytes[0], bytes[1], bytes[2], bytes[3]) === "RIFF" &&
    String.fromCharCode(bytes[8], bytes[9], bytes[10], bytes[11]) === "WAVE"
  );
};

const preparePiperWav = (result) => {
  const bytes = toUint8Array(result);

  if (!bytes || bytes.length === 0) {
    throw new Error("Piper audio data empty.");
  }

  if (isWav(bytes)) {
    return bytes;
  }

  return pcmToWav([bytes], PIPER_SAMPLE_RATE, 1);
};

const removeWakeWord = (text, wakeWord) => {
  if (!text || !wakeWord) {
    return String(text || "").trim();
  }

  const escaped = String(wakeWord).replace(/[.*+?^${}()|[\]\\]/g, "\\$&");

  return String(text)
    .replace(new RegExp(`\\b${escaped}\\b`, "i"), "")
    .replace(/\s+/g, " ")
    .trim();
};

// ============================================================
// COMPONENT
// ============================================================

export default function AssistantScreen() {
  const { colors } = useTheme();

  const insets = useSafeAreaInsets();

  // ==========================================================
  // UI
  // ==========================================================

  const [status, setStatus] = useState("starting");

  const [statusMessage, setStatusMessage] = useState("Checking server...");

  const [listening, setListening] = useState(false);

  const [processing, setProcessing] = useState(false);

  const [voiceDetected, setVoiceDetected] = useState(false);

  const [transcript, setTranscript] = useState("");

  const [wakeWord, setWakeWord] = useState(null);

  const [assistantResponse, setAssistantResponse] = useState("");

  const [message, setMessage] = useState(null);

  const [serverOnline, setServerOnline] = useState(null);

  const [voskOnline, setVoskOnline] = useState(null);

  const [piperOnline, setPiperOnline] = useState(null);

  const [serverConfigured, setServerConfigured] = useState(false);

  const [configuredWakeWord, setConfiguredWakeWord] =
    useState(DEFAULT_WAKE_WORD);

  const [userName, setUserName] = useState(DEFAULT_USER_NAME);

  // ==========================================================
  // REFS
  // ==========================================================

  const mountedRef = useRef(false);

  const initializingRef = useRef(false);

  const finishingRef = useRef(false);

  const processingRef = useRef(false);

  const pausedRef = useRef(false);

  const streamRef = useRef(null);

  // ==========================================================
  // CONFIG REF
  // ==========================================================

  const configRef = useRef({
    wakeWord: DEFAULT_WAKE_WORD,
    userName: DEFAULT_USER_NAME,
    systemPrompt: DEFAULT_SYSTEM_PROMPT,
  });

  // ==========================================================
  // COMMAND MODE
  // ==========================================================

  const awaitingCommandRef = useRef(false);

  const commandTimerRef = useRef(null);

  // ==========================================================
  // VAD
  // ==========================================================

  const noiseFloorRef = useRef(0);

  const smoothedRmsRef = useRef(0);

  const speechRef = useRef(false);

  const confirmCountRef = useRef(0);

  const silenceCountRef = useRef(0);

  const speechChunksRef = useRef([]);

  const preRollRef = useRef([]);

  const speechDurationRef = useRef(0);

  const startThresholdRef = useRef(getSpeechThreshold(0));

  const sampleRateRef = useRef(VOICE_CONFIG.sampleRate);

  const channelsRef = useRef(VOICE_CONFIG.channels);

  // ==========================================================
  // PLAYBACK
  // ==========================================================

  const playbackActiveRef = useRef(false);

  const pendingPlayRef = useRef(false);

  const playbackResolverRef = useRef(null);

  const ignoreAudioUntilRef = useRef(0);

  // ==========================================================
  // PLAYER
  // ==========================================================

  const player = useAudioPlayer(null, {
    updateInterval: 250,
  });

  const playerStatus = useAudioPlayerStatus(player);

  // ==========================================================
  // ANIMATION
  // ==========================================================

  const pulse = useRef(new Animated.Value(1)).current;

  useEffect(() => {
    const animation = Animated.loop(
      Animated.sequence([
        Animated.timing(pulse, {
          toValue: 1.05,
          duration: 1200,
          useNativeDriver: true,
        }),

        Animated.timing(pulse, {
          toValue: 1,
          duration: 1200,
          useNativeDriver: true,
        }),
      ]),
    );

    animation.start();

    return () => animation.stop();
  }, [pulse]);

  // ==========================================================
  // CONFIGURE AUDIO
  // ==========================================================

  const configureAudio = useCallback(async () => {
    await setAudioModeAsync({
      allowsRecording: true,
      allowsBackgroundRecording: true,
      playsInSilentMode: true,
      shouldPlayInBackground: true,
      shouldRouteThroughEarpiece: false,
      interruptionMode: "doNotMix",
    });
  }, []);

  // ==========================================================
  // CLEAR COMMAND MODE
  // ==========================================================

  const clearCommandMode = useCallback(() => {
    awaitingCommandRef.current = false;

    if (commandTimerRef.current) {
      clearTimeout(commandTimerRef.current);

      commandTimerRef.current = null;
    }
  }, []);

  const startCommandMode = useCallback(() => {
    awaitingCommandRef.current = true;

    if (commandTimerRef.current) {
      clearTimeout(commandTimerRef.current);
    }

    commandTimerRef.current = setTimeout(() => {
      awaitingCommandRef.current = false;

      commandTimerRef.current = null;
    }, COMMAND_WAIT_MS);
  }, []);

  // ==========================================================
  // PLAYBACK RESOLVER
  // ==========================================================

  const finishPlayback = useCallback((success) => {
    const resolver = playbackResolverRef.current;

    playbackResolverRef.current = null;

    pendingPlayRef.current = false;

    playbackActiveRef.current = false;

    ignoreAudioUntilRef.current = Date.now() + POST_PLAYBACK_IGNORE_MS;

    if (resolver) {
      resolver(success);
    }
  }, []);

  // ==========================================================
  // STOP PLAYBACK
  // ==========================================================

  const stopPlayback = useCallback(() => {
    try {
      player.pause();
      player.seekTo(0);
    } catch (error) {
      console.error("Stop playback error:", error);
    }

    finishPlayback(false);
  }, [finishPlayback, player]);

  // ==========================================================
  // PLAY WAV + WAIT
  // ==========================================================

  const playWavAndWait = useCallback(
    async (uri) => {
      if (!uri) {
        return false;
      }

      return await new Promise((resolve) => {
        try {
          stopPlayback();

          playbackActiveRef.current = true;

          pendingPlayRef.current = true;

          playbackResolverRef.current = resolve;

          player.volume = 1;

          player.replace({
            uri,
          });
        } catch (error) {
          console.error("Playback error:", error);

          finishPlayback(false);
        }
      });
    },
    [finishPlayback, player, stopPlayback],
  );

  // ==========================================================
  // PIPER SPEAK
  // ==========================================================

  const speakText = useCallback(
    async (text) => {
      if (!text || !mountedRef.current) {
        return false;
      }

      let uri = null;

      try {
        const piperResult = await ListenPiper(text);

        if (piperResult?.success === false) {
          return false;
        }

        const piperWav = preparePiperWav(piperResult);

        uri = await saveWavForPlayback(piperWav);

        return await playWavAndWait(uri);
      } catch (error) {
        console.error("Piper error:", error);

        return false;
      } finally {
        if (uri) {
          await deleteWavFile(uri).catch(() => {});
        }
      }
    },
    [playWavAndWait],
  );

  // ==========================================================
  // PLAYER STATUS
  // ==========================================================

  useEffect(() => {
    if (!mountedRef.current) {
      return;
    }

    if (pendingPlayRef.current && playerStatus?.isLoaded) {
      pendingPlayRef.current = false;

      try {
        player.volume = 1;
        player.play();
      } catch (error) {
        console.error("Playback error:", error);

        finishPlayback(false);
      }
    }

    if (playerStatus?.error && playbackActiveRef.current) {
      finishPlayback(false);
    }

    if (playerStatus?.didJustFinish && playbackActiveRef.current) {
      finishPlayback(true);
    }
  }, [
    finishPlayback,
    player,
    playerStatus?.isLoaded,
    playerStatus?.error,
    playerStatus?.didJustFinish,
  ]);

  // ==========================================================
  // HEALTH CHECK
  // ==========================================================

  const refreshHealth = useCallback(async () => {
    const baseURL = await getIp();

    if (!baseURL) {
      setServerConfigured(false);

      setServerOnline(false);

      setVoskOnline(false);

      setPiperOnline(false);

      return false;
    }

    setServerConfigured(true);

    const server = await checkServerStatus();

    if (!server?.success) {
      setServerOnline(false);

      setVoskOnline(false);

      setPiperOnline(false);

      return false;
    }

    setServerOnline(true);

    const [vosk, piper] = await Promise.all([
      checkVoskStatus(),
      checkPiperStatus(),
    ]);

    setVoskOnline(!!vosk?.success);

    setPiperOnline(!!piper?.success);

    return true;
  }, []);

  // ==========================================================
  // PROCESS VOICE
  // ==========================================================

  const finishVoiceRecording = useCallback(
    async (sampleRate, channels) => {
      if (finishingRef.current || !speechRef.current) {
        return;
      }

      finishingRef.current = true;

      processingRef.current = true;

      try {
        speechRef.current = false;

        confirmCountRef.current = 0;

        silenceCountRef.current = 0;

        const chunks = [...speechChunksRef.current];

        const recordedDuration = speechDurationRef.current;

        speechChunksRef.current = [];

        preRollRef.current = [];

        speechDurationRef.current = 0;

        if (mountedRef.current) {
          setVoiceDetected(false);

          setProcessing(true);

          setStatus("transcribing");

          setStatusMessage("Understanding your voice...");

          setMessage(null);
        }

        console.log("VOICE END:", Math.round(recordedDuration), "ms");

        if (recordedDuration < VOICE_CONFIG.minSpeechMs) {
          console.log("Voice too short - ignored");

          return;
        }

        if (!chunks.length) {
          return;
        }

        // ==================================================
        // SERVER GATE
        // ==================================================

        const baseURL = await getIp();

        if (!baseURL) {
          setServerConfigured(false);

          if (mountedRef.current) {
            setProcessing(false);

            setStatus("error");

            setStatusMessage("Server not configured");

            setMessage("Server se connect karein.");
          }

          return;
        }

        // ==================================================
        // WAV -> VOSK
        // ==================================================

        const wavBytes = pcmToWav(chunks, sampleRate, channels);

        const voskUri = await saveWavForVosk(wavBytes);

        let voskResult;

        try {
          voskResult = await transcribeAudio(voskUri);

          console.log("Vosk Result:", voskResult?.data?.text);

          if (voskResult?.success === false) {
            if (mountedRef.current) {
              setProcessing(false);

              setStatus("listening");

              setStatusMessage("Listening for " + configRef.current.wakeWord);

              setMessage(voskResult?.message || "Vosk unavailable.");
            }

            return;
          }
        } finally {
          await deleteWavFile(voskUri);
        }

        // ==================================================
        // TEXT
        // ==================================================

        const cleanText = getVoskText(voskResult);

        console.log("Transcript:", cleanText);

        if (mountedRef.current) {
          setTranscript(cleanText);
        }

        if (!cleanText) {
          if (mountedRef.current) {
            setProcessing(false);

            setStatus("listening");

            setStatusMessage("Listening for " + configRef.current.wakeWord);
          }

          return;
        }

        // ==================================================
        // WAKE WORD
        // ==================================================

        const detectedWakeWord = WalkWordDetector(
          voskResult,
          configRef.current.wakeWord,
        );

        console.log("Wake Word:", detectedWakeWord);

        if (mountedRef.current) {
          setWakeWord(detectedWakeWord);
        }

        const commandFromWake = detectedWakeWord
          ? removeWakeWord(cleanText, detectedWakeWord)
          : "";

        const alreadyWaiting = awaitingCommandRef.current;

        // ==================================================
        // IGNORE NORMAL SPEECH
        // ==================================================

        if (!detectedWakeWord && !alreadyWaiting) {
          console.log("No wake word detected");

          if (mountedRef.current) {
            setProcessing(false);

            setStatus("listening");

            setStatusMessage(`Listening for ${configRef.current.wakeWord}`);
          }

          return;
        }

        // ==================================================
        // COMMAND
        // ==================================================

        let command = "";

        if (detectedWakeWord) {
          command = commandFromWake;
        } else {
          command = cleanText;
        }

        // ==================================================
        // WAKE ACK TEXT
        // ==================================================

        const wakeAck = detectedWakeWord
          ? getWakeWordResponse(configRef.current.userName)
          : "";

        // ==================================================
        // WAKE WORD DETECTED
        // ==================================================

        if (detectedWakeWord && mountedRef.current) {
          setStatus("acknowledging");

          setStatusMessage("I'm listening...");

          setAssistantResponse(wakeAck);

          setMessage("Wake word detected.");
        }

        // ==================================================
        // WAKE WORD ONLY
        // ==================================================

        if (!command) {
          clearCommandMode();

          if (detectedWakeWord) {
            startCommandMode();

            await speakText(wakeAck);

            if (mountedRef.current) {
              setProcessing(false);

              setStatus("command");

              setStatusMessage("Listening for your request");

              setAssistantResponse("");

              setMessage("Wake word acknowledged.");
            }

            return;
          }

          return;
        }

        // ==================================================
        // COMMAND MODE COMPLETE
        // ==================================================

        clearCommandMode();

        // ==================================================
        // WAKE ACK + LLAMA
        // ==================================================

        const wakeAckPromise = detectedWakeWord
          ? speakText(wakeAck)
          : Promise.resolve(true);

        if (mountedRef.current) {
          setStatus("thinking");

          setStatusMessage("Thinking about your request...");
        }

        // ==================================================
        // LLAMA PROMPT
        // ==================================================

        const llamaPrompt =
          `${configRef.current.systemPrompt}\n\n` +
          `User Name: ${configRef.current.userName}\n\n` +
          `User Request: ${command}`;

        console.log("Llama Prompt:", llamaPrompt);

        // ==================================================
        // LLAMA REQUEST
        // ==================================================

        const llamaPromise = AskLlama(llamaPrompt);

        // ==================================================
        // PROCESSING ACK
        // ==================================================

        let llamaFinished = false;

        const processingAckPromise = (async () => {
          await new Promise((resolve) => setTimeout(resolve, 900));

          if (llamaFinished || !mountedRef.current) {
            return;
          }

          await wakeAckPromise;

          if (llamaFinished || !mountedRef.current) {
            return;
          }

          const processingText = getProcessingResponse(
            configRef.current.userName,
          );

          setStatus("processing");

          setStatusMessage("Still working...");

          setAssistantResponse(processingText);

          await speakText(processingText);
        })();

        // ==================================================
        // WAIT LLAMA
        // ==================================================

        const llamaResult = await llamaPromise;

        llamaFinished = true;

        await processingAckPromise;

        // ==================================================
        // LLAMA ERROR
        // ==================================================

        if (!llamaResult || llamaResult?.success === false) {
          await wakeAckPromise;

          if (mountedRef.current) {
            setProcessing(false);

            setStatus("listening");

            setStatusMessage(`Listening for ${configRef.current.wakeWord}`);

            setMessage(llamaResult?.message || "Llama unavailable.");

            setAssistantResponse("");
          }

          return;
        }

        // ==================================================
        // LLAMA ANSWER
        // ==================================================

        const answer = getLlamaAnswer(llamaResult);

        console.log("Llama Answer:", answer);

        if (mountedRef.current) {
          setAssistantResponse(answer);
        }

        if (!answer) {
          await wakeAckPromise;

          if (mountedRef.current) {
            setProcessing(false);

            setStatus("listening");

            setStatusMessage(`Listening for ${configRef.current.wakeWord}`);

            setMessage("Llama ne response nahi diya.");
          }

          return;
        }

        // ==================================================
        // WAIT WAKE ACK
        // ==================================================

        await wakeAckPromise;

        // ==================================================
        // FINAL PIPER
        // ==================================================

        if (mountedRef.current) {
          setStatus("speaking");

          setStatusMessage("JARVIS is preparing your response...");
        }

        await speakText(answer);

        if (mountedRef.current) {
          setProcessing(false);

          setStatus("listening");

          setStatusMessage(`Listening for ${configRef.current.wakeWord}`);

          setMessage("Ready.");
        }
      } catch (error) {
        console.error("Voice processing error:", error);

        if (mountedRef.current) {
          setProcessing(false);

          setStatus("listening");

          setStatusMessage(`Listening for ${configRef.current.wakeWord}`);

          setMessage(error?.message || "Voice processing failed.");
        }
      } finally {
        finishingRef.current = false;

        processingRef.current = false;
      }
    },
    [clearCommandMode, speakText, startCommandMode],
  );

  // ==========================================================
  // AUDIO BUFFER
  // ==========================================================

  const handleAudioBuffer = useCallback(
    (buffer) => {
      if (
        !buffer?.data ||
        !mountedRef.current ||
        finishingRef.current ||
        processingRef.current ||
        pausedRef.current ||
        playbackActiveRef.current
      ) {
        return;
      }

      if (Date.now() < ignoreAudioUntilRef.current) {
        return;
      }

      const data = buffer.data;

      const sampleRate = buffer.sampleRate || VOICE_CONFIG.sampleRate;

      const channels = buffer.channels || VOICE_CONFIG.channels;

      sampleRateRef.current = sampleRate;

      channelsRef.current = channels;

      const bufferMs = (data.byteLength / 2 / channels / sampleRate) * 1000;

      const rms = getRmsLevel(data);

      if (smoothedRmsRef.current === 0) {
        smoothedRmsRef.current = rms;
      } else {
        smoothedRmsRef.current = smoothedRmsRef.current * 0.7 + rms * 0.3;
      }

      const smoothRms = smoothedRmsRef.current;

      // ======================================================
      // WAITING
      // ======================================================

      if (!speechRef.current) {
        preRollRef.current.push(data.slice(0));

        if (preRollRef.current.length > PRE_ROLL_BUFFERS) {
          preRollRef.current.shift();
        }

        const threshold = getSpeechThreshold(noiseFloorRef.current);

        const voice = isVoiceLevel(smoothRms, threshold);

        if (!voice) {
          noiseFloorRef.current = updateNoiseFloor(
            noiseFloorRef.current,
            smoothRms,
          );
        }

        const currentThreshold = getSpeechThreshold(noiseFloorRef.current);

        const currentVoice = isVoiceLevel(smoothRms, currentThreshold);

        if (currentVoice) {
          confirmCountRef.current += 1;
        } else {
          confirmCountRef.current = 0;
        }

        if (confirmCountRef.current >= VOICE_CONFIG.startConfirmBuffers) {
          speechRef.current = true;

          silenceCountRef.current = 0;

          speechDurationRef.current = preRollRef.current.length * bufferMs;

          startThresholdRef.current = currentThreshold;

          speechChunksRef.current = [...preRollRef.current];

          preRollRef.current = [];

          confirmCountRef.current = 0;

          if (mountedRef.current) {
            setVoiceDetected(true);

            setStatus("voice");

            setStatusMessage("Listening to you...");

            setMessage(null);
          }

          console.log("VOICE START");
        }

        return;
      }

      // ======================================================
      // ACTIVE
      // ======================================================

      speechChunksRef.current.push(data.slice(0));

      speechDurationRef.current += bufferMs;

      const stopThreshold = getStopThreshold(startThresholdRef.current);

      const active = isVoiceLevel(smoothRms, stopThreshold);

      if (active) {
        silenceCountRef.current = 0;
      } else {
        silenceCountRef.current += 1;
      }

      if (speechDurationRef.current >= VOICE_CONFIG.maxSpeechMs) {
        finishVoiceRecording(sampleRate, channels);

        return;
      }

      if (silenceCountRef.current >= VOICE_CONFIG.silenceBuffers) {
        finishVoiceRecording(sampleRate, channels);
      }
    },
    [finishVoiceRecording],
  );

  // ==========================================================
  // AUDIO STREAM
  // ==========================================================

  const audioStreamResult = useAudioStream({
    sampleRate: VOICE_CONFIG.sampleRate,

    channels: VOICE_CONFIG.channels,

    encoding: VOICE_CONFIG.encoding,

    onBuffer: handleAudioBuffer,
  });

  const stream = audioStreamResult.stream;

  const isStreaming = audioStreamResult.isStreaming;

  streamRef.current = stream;

  // ==========================================================
  // STREAM STATE
  // ==========================================================

  useEffect(() => {
    if (!mountedRef.current) {
      return;
    }

    setListening(isStreaming);
  }, [isStreaming]);

  // ==========================================================
  // INITIALIZE
  // ==========================================================

  useEffect(() => {
    mountedRef.current = true;

    let cancelled = false;

    const initialize = async () => {
      if (initializingRef.current) {
        return;
      }

      initializingRef.current = true;

      try {
        // ==================================================
        // SERVER FIRST
        // ==================================================

        const baseURL = await getIp();

        if (!baseURL) {
          setServerConfigured(false);

          setServerOnline(false);

          setStatus("error");

          setStatusMessage("Server not connected");

          Alert.alert(
            "Server Connection",
            "Server se connection nahi hai. Pehle server se connect karein.",
          );

          return;
        }

        const server = await checkServerStatus();

        if (!server?.success) {
          setServerConfigured(true);

          setServerOnline(false);

          setStatus("error");

          setStatusMessage("Server not connected");

          Alert.alert(
            "Server Connection",
            "Server se connection nahi hai. Pehle server se connect karein.",
          );

          return;
        }

        if (cancelled || !mountedRef.current) {
          return;
        }

        setServerConfigured(true);

        setServerOnline(true);

        // ==================================================
        // LOAD ASSISTANT CONFIG
        // ==================================================

        const settings = await loadSettings();

        const assistantConfig = {
          wakeWord: settings.wakeWord || DEFAULT_WAKE_WORD,

          userName: settings.userName || DEFAULT_USER_NAME,

          systemPrompt: settings.systemPrompt || DEFAULT_SYSTEM_PROMPT,
        };

        configRef.current = assistantConfig;

        setConfiguredWakeWord(assistantConfig.wakeWord);

        setUserName(assistantConfig.userName);

        // ==================================================
        // AUDIO
        // ==================================================

        await configureAudio();

        const permission = await AudioModule.requestRecordingPermissionsAsync();

        if (cancelled || !mountedRef.current) {
          return;
        }

        if (!permission.granted) {
          setStatus("error");

          setStatusMessage("Microphone permission required.");

          Alert.alert(
            "Microphone Permission",
            "Microphone permission allow karo.",
          );

          return;
        }

        const currentStream = streamRef.current;

        if (!currentStream) {
          setStatus("error");

          setStatusMessage("Voice sensor available nahi hai.");

          return;
        }

        if (!currentStream.isStreaming) {
          await currentStream.start();
        }

        await refreshHealth();

        if (cancelled || !mountedRef.current) {
          return;
        }

        setListening(true);

        setStatus("listening");

        setStatusMessage(`Listening for ${assistantConfig.wakeWord}`);
      } catch (error) {
        console.error("Audio initialization error:", error);

        if (!cancelled && mountedRef.current) {
          setStatus("error");

          setStatusMessage("Assistant start nahi ho saka.");
        }
      } finally {
        initializingRef.current = false;
      }
    };

    initialize();

    return () => {
      cancelled = true;

      mountedRef.current = false;

      clearCommandMode();

      speechRef.current = false;

      finishingRef.current = false;

      processingRef.current = false;

      playbackActiveRef.current = false;

      pendingPlayRef.current = false;

      speechChunksRef.current = [];

      preRollRef.current = [];

      confirmCountRef.current = 0;

      silenceCountRef.current = 0;

      speechDurationRef.current = 0;

      try {
        player.pause();
      } catch {}
    };
  }, [clearCommandMode, configureAudio, player, refreshHealth]);

  // ==========================================================
  // PAUSE / RESUME
  // ==========================================================

  const toggleListening = async () => {
    try {
      if (pausedRef.current) {
        pausedRef.current = false;

        await configureAudio();

        const currentStream = streamRef.current;

        if (currentStream && !currentStream.isStreaming) {
          await currentStream.start();
        }

        setListening(true);

        setStatus("listening");

        setStatusMessage(`Listening for ${configRef.current.wakeWord}`);

        return;
      }

      pausedRef.current = true;

      stopPlayback();

      speechRef.current = false;

      confirmCountRef.current = 0;

      silenceCountRef.current = 0;

      speechChunksRef.current = [];

      preRollRef.current = [];

      speechDurationRef.current = 0;

      clearCommandMode();

      const currentStream = streamRef.current;

      if (currentStream && currentStream.isStreaming) {
        await currentStream.stop();
      }

      setListening(false);

      setVoiceDetected(false);

      setProcessing(false);

      setStatus("paused");

      setStatusMessage("Listening paused");
    } catch (error) {
      console.error("Listening control error:", error);

      setStatus("error");

      setStatusMessage("Voice sensor change nahi ho saka.");
    }
  };

  // ==========================================================
  // STATUS
  // ==========================================================

  const statusConfig = {
    starting: {
      title: "Starting",
      bg: colors.infoBg,
      dot: colors.info,
    },

    listening: {
      title: "Listening",
      bg: colors.successBg,
      dot: colors.success,
    },

    voice: {
      title: "Voice Detected",
      bg: colors.infoBg,
      dot: colors.info,
    },

    transcribing: {
      title: "Understanding",
      bg: colors.infoBg,
      dot: colors.info,
    },

    acknowledging: {
      title: "I'm Listening",
      bg: colors.successBg,
      dot: colors.success,
    },

    command: {
      title: "Ready",
      bg: colors.successBg,
      dot: colors.success,
    },

    thinking: {
      title: "Thinking",
      bg: colors.infoBg,
      dot: colors.info,
    },

    processing: {
      title: "Processing",
      bg: colors.infoBg,
      dot: colors.info,
    },

    speaking: {
      title: "Speaking",
      bg: colors.successBg,
      dot: colors.success,
    },

    paused: {
      title: "Paused",
      bg: colors.elevated,
      dot: colors.muted,
    },

    error: {
      title: "Unavailable",
      bg: colors.dangerBg,
      dot: colors.danger,
    },
  };

  const currentStatus = statusConfig[status] || statusConfig.starting;

  return (
    <View
      style={[
        styles.root,
        {
          backgroundColor: colors.background,
          paddingTop: Math.max(insets.top, 12),
        },
      ]}
    >
      <ScrollView
        contentContainerStyle={styles.content}
        showsVerticalScrollIndicator={false}
      >
        {/* ================================================= */}
        {/* HEADER */}
        {/* ================================================= */}

        <View style={styles.header}>
          <View>
            <Text
              style={[
                styles.brand,
                {
                  color: colors.text,
                },
              ]}
            >
              JARVIS
            </Text>

            <Text
              style={[
                styles.subtitle,
                {
                  color: colors.muted,
                },
              ]}
            >
              Personal AI Assistant
            </Text>
          </View>

          <Pressable
            onPress={() => router.push("/settings")}
            style={[
              styles.settingsButton,
              {
                backgroundColor: colors.surface,
                borderColor: colors.border,
              },
            ]}
          >
            <Text
              style={[
                styles.settingsText,
                {
                  color: colors.text,
                },
              ]}
            >
              ⚙
            </Text>
          </Pressable>
        </View>

        {/* ================================================= */}
        {/* ORB */}
        {/* ================================================= */}

        <View style={styles.orbSection}>
          <Animated.View
            style={[
              styles.orbOuter,
              {
                backgroundColor: colors.elevated,
                borderColor: colors.border,
                transform: [
                  {
                    scale: pulse,
                  },
                ],
              },
            ]}
          >
            <View
              style={[
                styles.orbInner,
                {
                  backgroundColor: colors.accent,
                },
              ]}
            >
              {processing ? (
                <ActivityIndicator color={colors.accentText} size="small" />
              ) : (
                <Text
                  style={[
                    styles.orbJ,
                    {
                      color: colors.accentText,
                    },
                  ]}
                >
                  J
                </Text>
              )}
            </View>
          </Animated.View>

          <Text
            style={[
              styles.sayText,
              {
                color: colors.text,
              },
            ]}
          >
            Say <Text style={styles.wakeStrong}>“{configuredWakeWord}”</Text>
          </Text>

          <Text
            style={[
              styles.orbHint,
              {
                color: colors.muted,
              },
            ]}
          >
            Ready for your voice.
          </Text>
        </View>

        {/* ================================================= */}
        {/* STATUS */}
        {/* ================================================= */}

        <View
          style={[
            styles.statusCard,
            {
              backgroundColor: currentStatus.bg,
              borderColor: colors.border,
            },
          ]}
        >
          <View
            style={[
              styles.statusDot,
              {
                backgroundColor: currentStatus.dot,
              },
            ]}
          />

          <View style={styles.statusInfo}>
            <Text
              style={[
                styles.statusTitle,
                {
                  color: colors.text,
                },
              ]}
            >
              {currentStatus.title}
            </Text>

            <Text
              style={[
                styles.statusMessage,
                {
                  color: colors.muted,
                },
              ]}
            >
              {statusMessage}
            </Text>
          </View>
        </View>

        {/* ================================================= */}
        {/* SERVICES */}
        {/* ================================================= */}

        <View
          style={[
            styles.services,
            {
              backgroundColor: colors.surface,
              borderColor: colors.border,
            },
          ]}
        >
          <Service
            title="Server"
            online={serverConfigured ? serverOnline : null}
            colors={colors}
          />

          <Service
            title="Vosk"
            online={serverConfigured ? voskOnline : null}
            colors={colors}
          />

          <Service
            title="Piper"
            online={serverConfigured ? piperOnline : null}
            colors={colors}
          />
        </View>

        {/* ================================================= */}
        {/* TRANSCRIPT */}
        {/* ================================================= */}

        {transcript ? (
          <View
            style={[
              styles.card,
              {
                backgroundColor: colors.surface,
                borderColor: colors.border,
              },
            ]}
          >
            <Text
              style={[
                styles.label,
                {
                  color: colors.muted,
                },
              ]}
            >
              YOU SAID
            </Text>

            <Text
              style={[
                styles.transcript,
                {
                  color: colors.text,
                },
              ]}
            >
              {transcript}
            </Text>
          </View>
        ) : null}

        {/* ================================================= */}
        {/* RESPONSE */}
        {/* ================================================= */}

        {assistantResponse ? (
          <View
            style={[
              styles.responseCard,
              {
                backgroundColor: colors.accent,
              },
            ]}
          >
            <Text
              style={[
                styles.label,
                {
                  color: colors.accentText,
                },
              ]}
            >
              JARVIS
            </Text>

            <Text
              style={[
                styles.responseText,
                {
                  color: colors.accentText,
                },
              ]}
            >
              {assistantResponse}
            </Text>
          </View>
        ) : null}

        {/* ================================================= */}
        {/* MESSAGE */}
        {/* ================================================= */}

        {message ? (
          <View
            style={[
              styles.notice,
              {
                backgroundColor: colors.elevated,
                borderColor: colors.border,
              },
            ]}
          >
            <Text
              style={[
                styles.noticeText,
                {
                  color: colors.muted,
                },
              ]}
            >
              {message}
            </Text>
          </View>
        ) : null}

        {/* ================================================= */}
        {/* CONTROL */}
        {/* ================================================= */}

        <Pressable
          onPress={toggleListening}
          style={[
            styles.controlButton,
            {
              backgroundColor: listening ? colors.surface : colors.accent,
              borderColor: colors.border,
            },
          ]}
        >
          <Text
            style={[
              styles.controlText,
              {
                color: listening ? colors.text : colors.accentText,
              },
            ]}
          >
            {listening ? "Pause Listening" : "Resume Listening"}
          </Text>
        </Pressable>

        <Text
          style={[
            styles.footer,
            {
              color: colors.subtle,
            },
          ]}
        >
          {userName ? `${userName} • ` : ""}
          Wake word: {configuredWakeWord}
        </Text>
      </ScrollView>
    </View>
  );
}

// ============================================================
// SERVICE COMPONENT
// ============================================================

function Service({ title, online, colors }) {
  const checking = online === null;

  const isOnline = online === true;

  return (
    <View style={styles.service}>
      <View
        style={[
          styles.serviceDot,
          {
            backgroundColor: checking
              ? colors.muted
              : isOnline
                ? colors.success
                : colors.danger,
          },
        ]}
      />

      <Text
        style={[
          styles.serviceTitle,
          {
            color: colors.text,
          },
        ]}
      >
        {title}
      </Text>

      <Text
        style={[
          styles.serviceValue,
          {
            color: checking
              ? colors.muted
              : isOnline
                ? colors.success
                : colors.danger,
          },
        ]}
      >
        {checking ? "Checking" : isOnline ? "Online" : "Offline"}
      </Text>
    </View>
  );
}

// ============================================================
// STYLES
// ============================================================

const styles = StyleSheet.create({
  root: {
    flex: 1,
  },

  content: {
    paddingHorizontal: 20,
    paddingBottom: 30,
  },

  header: {
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "space-between",
    marginBottom: 14,
  },

  brand: {
    fontSize: 29,
    fontWeight: "800",
    letterSpacing: 1,
  },

  subtitle: {
    fontSize: 12,
    marginTop: 3,
  },

  settingsButton: {
    width: 44,
    height: 44,
    borderRadius: 14,
    borderWidth: 1,
    alignItems: "center",
    justifyContent: "center",
  },

  settingsText: {
    fontSize: 20,
  },

  orbSection: {
    alignItems: "center",
    paddingVertical: 16,
  },

  orbOuter: {
    width: 142,
    height: 142,
    borderRadius: 71,
    borderWidth: 1,
    alignItems: "center",
    justifyContent: "center",
    marginBottom: 16,
  },

  orbInner: {
    width: 96,
    height: 96,
    borderRadius: 48,
    alignItems: "center",
    justifyContent: "center",
  },

  orbJ: {
    fontSize: 40,
    fontWeight: "800",
  },

  sayText: {
    fontSize: 18,
    fontWeight: "500",
  },

  wakeStrong: {
    fontWeight: "800",
  },

  orbHint: {
    fontSize: 12,
    marginTop: 5,
  },

  statusCard: {
    flexDirection: "row",
    alignItems: "center",
    borderWidth: 1,
    borderRadius: 18,
    padding: 15,
    marginBottom: 12,
  },

  statusDot: {
    width: 10,
    height: 10,
    borderRadius: 5,
    marginRight: 12,
  },

  statusInfo: {
    flex: 1,
  },

  statusTitle: {
    fontSize: 15,
    fontWeight: "700",
  },

  statusMessage: {
    fontSize: 12,
    marginTop: 3,
  },

  services: {
    flexDirection: "row",
    borderWidth: 1,
    borderRadius: 18,
    paddingVertical: 13,
    marginBottom: 12,
  },

  service: {
    flex: 1,
    alignItems: "center",
  },

  serviceDot: {
    width: 7,
    height: 7,
    borderRadius: 4,
    marginBottom: 5,
  },

  serviceTitle: {
    fontSize: 11,
    fontWeight: "700",
  },

  serviceValue: {
    fontSize: 9,
    marginTop: 2,
  },

  card: {
    borderWidth: 1,
    borderRadius: 18,
    padding: 15,
    marginBottom: 12,
  },

  label: {
    fontSize: 9,
    fontWeight: "800",
    letterSpacing: 1,
    marginBottom: 7,
  },

  transcript: {
    fontSize: 16,
    lineHeight: 24,
    fontWeight: "500",
  },

  responseCard: {
    borderRadius: 18,
    padding: 17,
    marginBottom: 12,
  },

  responseText: {
    fontSize: 18,
    lineHeight: 26,
    fontWeight: "500",
  },

  notice: {
    borderWidth: 1,
    borderRadius: 14,
    padding: 12,
    marginBottom: 12,
  },

  noticeText: {
    fontSize: 12,
    textAlign: "center",
  },

  controlButton: {
    borderWidth: 1,
    borderRadius: 15,
    paddingVertical: 15,
    alignItems: "center",
  },

  controlText: {
    fontSize: 15,
    fontWeight: "700",
  },

  footer: {
    textAlign: "center",
    fontSize: 10,
    marginTop: 14,
  },
});

import { useCallback, useEffect, useRef, useState } from "react";

import { View, Text, Pressable, StyleSheet, Alert } from "react-native";

import {
  AudioModule,
  setAudioModeAsync,
  useAudioStream,
  useAudioPlayer,
  useAudioPlayerStatus,
} from "expo-audio";

import {
  VOICE_CONFIG,
  getRmsLevel,
  updateNoiseFloor,
  getSpeechThreshold,
  getStopThreshold,
  isVoiceLevel,
} from "../../services/audio/voiceDetection";

import { pcmToWav } from "../../services/audio/pcmToWav";

import {
  saveWavForPlayback,
  saveWavForVosk,
  deleteWavFile,
} from "../../services/audio/playPcmRecording";

import { AskLlama, ListenPiper, transcribeAudio } from "../../axios/api";

import WalkWordDetector from "../../utils/walkWordDetector";

// ============================================================
// CONFIG
// ============================================================

const PRE_ROLL_BUFFERS = 3;

const AUTO_PLAY_ASSISTANT = true;

const POST_PLAYBACK_IGNORE_MS = 700;

// Agar Piper raw PCM return kare
// aur WAV header na ho to ye sample rate use hoga.
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

const isWavFile = (bytes) => {
  if (!bytes || bytes.length < 12) {
    return false;
  }

  const riff = String.fromCharCode(bytes[0], bytes[1], bytes[2], bytes[3]);

  const wave = String.fromCharCode(bytes[8], bytes[9], bytes[10], bytes[11]);

  return riff === "RIFF" && wave === "WAVE";
};

const preparePiperWav = (piperResult) => {
  const bytes = toUint8Array(piperResult);

  if (!bytes || bytes.length === 0) {
    throw new Error("Piper audio data empty.");
  }

  // Piper already WAV return kar raha hai
  if (isWavFile(bytes)) {
    return bytes;
  }

  // Piper raw PCM return kar raha hai
  return pcmToWav([bytes], PIPER_SAMPLE_RATE, 1);
};

// ============================================================
// COMPONENT
// ============================================================

export default function AudioRecorder() {
  // ==========================================================
  // UI STATE
  // ==========================================================

  const [permissionGranted, setPermissionGranted] = useState(false);

  const [listening, setListening] = useState(false);

  const [voiceDetected, setVoiceDetected] = useState(false);

  const [recordingReady, setRecordingReady] = useState(false);

  const [playing, setPlaying] = useState(false);

  const [processing, setProcessing] = useState(false);

  const [duration, setDuration] = useState(0);

  const [message, setMessage] = useState(null);

  const [playbackUri, setPlaybackUri] = useState(null);

  const [assistantAudioUri, setAssistantAudioUri] = useState(null);

  const [transcript, setTranscript] = useState("");

  const [wakeWord, setWakeWord] = useState(null);

  const [assistantResponse, setAssistantResponse] = useState("");

  const [activePlayback, setActivePlayback] = useState(null);

  // ==========================================================
  // LIFECYCLE
  // ==========================================================

  const mountedRef = useRef(false);

  const initializingRef = useRef(false);

  const finishingRef = useRef(false);

  const processingRef = useRef(false);

  // ==========================================================
  // AUDIO STREAM
  // ==========================================================

  const streamRef = useRef(null);

  // ==========================================================
  // VOICE DETECTION
  // ==========================================================

  const noiseFloorRef = useRef(0);

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
  // FILE REFS
  // ==========================================================

  const recordingUriRef = useRef(null);

  const assistantAudioUriRef = useRef(null);

  // ==========================================================
  // PLAYBACK
  // ==========================================================

  const playbackActiveRef = useRef(false);

  const ignoreAudioUntilRef = useRef(0);

  const pendingPlayRef = useRef(false);

  // ==========================================================
  // PLAYER
  // ==========================================================

  const player = useAudioPlayer(null, {
    updateInterval: 250,
  });

  const playerStatus = useAudioPlayerStatus(player);

  // ==========================================================
  // PLAYER STATUS
  // ==========================================================

  useEffect(() => {
    if (!mountedRef.current) {
      return;
    }

    setPlaying(!!playerStatus?.playing);

    // Audio load hone ke baad play
    if (pendingPlayRef.current && playerStatus?.isLoaded) {
      pendingPlayRef.current = false;

      try {
        player.volume = 1;
        player.play();
      } catch (error) {
        console.error("Playback error:", error);

        playbackActiveRef.current = false;

        setPlaying(false);
        setActivePlayback(null);

        setMessage("Audio play nahi ho saki.");
      }
    }

    // Player error
    if (playerStatus?.error) {
      pendingPlayRef.current = false;

      playbackActiveRef.current = false;

      setPlaying(false);
      setActivePlayback(null);

      setMessage("Audio play nahi ho saki.");
    }

    // Playback finish
    if (playerStatus?.didJustFinish) {
      pendingPlayRef.current = false;

      playbackActiveRef.current = false;

      ignoreAudioUntilRef.current = Date.now() + POST_PLAYBACK_IGNORE_MS;

      setPlaying(false);
      setActivePlayback(null);
    }
  }, [
    playerStatus?.playing,
    playerStatus?.isLoaded,
    playerStatus?.error,
    playerStatus?.didJustFinish,
    player,
  ]);

  // ==========================================================
  // STOP PLAYBACK
  // ==========================================================

  const stopPlayback = useCallback(() => {
    pendingPlayRef.current = false;

    try {
      player.pause();
      player.seekTo(0);
    } catch (error) {
      console.error("Stop playback error:", error);
    }

    playbackActiveRef.current = false;

    ignoreAudioUntilRef.current = Date.now() + 300;

    if (mountedRef.current) {
      setPlaying(false);
      setActivePlayback(null);
    }
  }, [player]);

  // ==========================================================
  // DELETE OLD AUDIO FILES
  // ==========================================================

  const deleteOldAudioFiles = useCallback(async () => {
    const oldRecording = recordingUriRef.current;

    const oldAssistant = assistantAudioUriRef.current;

    recordingUriRef.current = null;

    assistantAudioUriRef.current = null;

    const files = [oldRecording, oldAssistant].filter(Boolean);

    if (!files.length) {
      return;
    }

    await Promise.all(
      [...new Set(files)].map((uri) => deleteWavFile(uri).catch(() => {})),
    );
  }, []);

  // ==========================================================
  // PLAY SOURCE
  // ==========================================================

  const playSource = useCallback(
    (uri, type) => {
      if (!uri) {
        return false;
      }

      try {
        playbackActiveRef.current = true;

        pendingPlayRef.current = true;

        if (mountedRef.current) {
          setActivePlayback(type);
          setPlaying(false);
          setMessage(null);
        }

        player.volume = 1;

        player.replace({
          uri,
        });

        return true;
      } catch (error) {
        console.error("Playback error:", error);

        pendingPlayRef.current = false;

        playbackActiveRef.current = false;

        if (mountedRef.current) {
          setPlaying(false);
          setActivePlayback(null);

          setMessage("Audio play nahi ho saki.");
        }

        return false;
      }
    },
    [player],
  );

  // ==========================================================
  // FINISH VOICE RECORDING
  // ==========================================================

  const finishVoiceRecording = useCallback(
    async (
      sampleRate = VOICE_CONFIG.sampleRate,
      channels = VOICE_CONFIG.channels,
    ) => {
      if (finishingRef.current || !speechRef.current) {
        return false;
      }

      finishingRef.current = true;
      processingRef.current = true;

      try {
        // ====================================================
        // LOCK VOICE STATE
        // ====================================================

        speechRef.current = false;

        confirmCountRef.current = 0;

        silenceCountRef.current = 0;

        // ====================================================
        // SNAPSHOT PCM
        // ====================================================

        const chunks = [...speechChunksRef.current];

        const recordedDuration = speechDurationRef.current;

        // ====================================================
        // CLEAR CURRENT BUFFER
        // ====================================================

        speechChunksRef.current = [];

        preRollRef.current = [];

        speechDurationRef.current = 0;

        if (mountedRef.current) {
          setVoiceDetected(false);
          setProcessing(true);
          setMessage(null);
        }

        console.log("VOICE END:", Math.round(recordedDuration), "ms");

        // ====================================================
        // TOO SHORT
        // ====================================================

        if (recordedDuration < VOICE_CONFIG.minSpeechMs) {
          console.log("Voice too short - ignored");

          if (mountedRef.current) {
            setProcessing(false);
            setRecordingReady(false);
            setTranscript("");
            setWakeWord(null);
            setAssistantResponse("");
            setAssistantAudioUri(null);
            setDuration(0);
          }

          return false;
        }

        if (!chunks.length) {
          if (mountedRef.current) {
            setProcessing(false);
          }

          return false;
        }

        // ====================================================
        // STOP OLD PLAYBACK
        // ====================================================

        stopPlayback();

        // ====================================================
        // DELETE OLD FILES
        // IMPORTANT:
        // New files create hone se pehle old files delete
        // ====================================================

        await deleteOldAudioFiles();

        // ====================================================
        // PCM -> WAV
        // ====================================================

        const wavBytes = pcmToWav(chunks, sampleRate, channels);

        // ====================================================
        // SAVE USER RECORDING
        // ====================================================

        const newRecordingUri = await saveWavForPlayback(wavBytes);

        recordingUriRef.current = newRecordingUri;

        if (mountedRef.current) {
          setPlaybackUri(newRecordingUri);

          setRecordingReady(true);
        }

        // ====================================================
        // SAVE VOSK TEMP FILE
        // ====================================================

        const voskUri = await saveWavForVosk(wavBytes);

        let voskResult;

        try {
          voskResult = await transcribeAudio(voskUri);

          console.log("Vosk Result:", voskResult?.data?.text);

          if (voskResult?.success === false) {
            throw new Error(
              voskResult?.message || "Vosk transcription failed.",
            );
          }
        } finally {
          await deleteWavFile(voskUri);
        }

        // ====================================================
        // GET TEXT
        // ====================================================

        const cleanText = getVoskText(voskResult);

        console.log("Transcript:", cleanText);

        if (mountedRef.current) {
          setTranscript(cleanText);
        }

        // ====================================================
        // WAKE WORD
        // ====================================================

        const detectedWakeWord = WalkWordDetector(voskResult);

        console.log("Wake Word:", detectedWakeWord);

        if (mountedRef.current) {
          setWakeWord(detectedWakeWord);
        }

        // ====================================================
        // NO WAKE WORD
        // ====================================================

        if (!detectedWakeWord) {
          console.log("No wake word detected");

          if (mountedRef.current) {
            setProcessing(false);
            setRecordingReady(true);

            setDuration(Math.round(recordedDuration));

            setMessage("Wake word nahi mili.");
          }

          return true;
        }

        // ====================================================
        // REMOVE WAKE WORD
        // ====================================================

        const escapedWakeWord = String(detectedWakeWord).replace(
          /[.*+?^${}()|[\]\\]/g,
          "\\$&",
        );

        const command = cleanText
          .replace(new RegExp(`\\b${escapedWakeWord}\\b`, "i"), "")
          .replace(/\s+/g, " ")
          .trim();

        console.log("Command:", command);

        // ====================================================
        // LLAMA
        // ====================================================

        let llamaResult;

        if (command) {
          llamaResult = await AskLlama(command);
        } else {
          llamaResult = await AskLlama(
            `Wake word "${detectedWakeWord}" detected. Give a very short friendly greeting.`,
          );
        }

        console.log("Llama Response:", llamaResult?.data?.answer);

        if (llamaResult?.success === false) {
          throw new Error(llamaResult?.message || "Llama is not available.");
        }

        // ====================================================
        // GET LLAMA ANSWER
        // ====================================================

        const answer = getLlamaAnswer(llamaResult);

        console.log("Llama Answer:", answer);

        if (mountedRef.current) {
          setAssistantResponse(answer);
        }

        // ====================================================
        // NO LLAMA ANSWER
        // ====================================================

        if (!answer) {
          if (mountedRef.current) {
            setProcessing(false);

            setMessage("Wake word detected, lekin response nahi mili.");
          }

          return true;
        }

        // ====================================================
        // PIPER
        // ====================================================

        const piperResult = await ListenPiper(answer);

        if (piperResult?.success === false) {
          throw new Error(piperResult?.message || "Piper is not available.");
        }

        // ====================================================
        // PREPARE PIPER AUDIO
        // ====================================================

        const piperWav = preparePiperWav(piperResult);

        // ====================================================
        // SAVE PIPER AUDIO
        // ====================================================

        const newAssistantAudioUri = await saveWavForPlayback(piperWav);

        assistantAudioUriRef.current = newAssistantAudioUri;

        if (mountedRef.current) {
          setAssistantAudioUri(newAssistantAudioUri);
        }

        console.log("Piper audio saved:", newAssistantAudioUri);

        // ====================================================
        // FINAL UI
        // ====================================================

        if (mountedRef.current) {
          setRecordingReady(true);

          setDuration(Math.round(recordedDuration));

          setProcessing(false);

          setPlaying(false);

          setActivePlayback(null);

          setMessage("Assistant ready.");
        }

        // ====================================================
        // AUTO PLAY PIPER
        // ====================================================

        if (AUTO_PLAY_ASSISTANT && newAssistantAudioUri && mountedRef.current) {
          playSource(newAssistantAudioUri, "assistant");
        }

        return true;
      } catch (error) {
        console.error("Voice processing error:", error);

        if (mountedRef.current) {
          setProcessing(false);
          setVoiceDetected(false);

          setMessage(error?.message || "Voice processing failed.");
        }

        return false;
      } finally {
        finishingRef.current = false;

        processingRef.current = false;
      }
    },
    [deleteOldAudioFiles, playSource, stopPlayback],
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
        playbackActiveRef.current
      ) {
        return;
      }

      // Playback ke baad short protection
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

      // ======================================================
      // WAITING FOR VOICE
      // ======================================================

      if (!speechRef.current) {
        preRollRef.current.push(data.slice(0));

        if (preRollRef.current.length > PRE_ROLL_BUFFERS) {
          preRollRef.current.shift();
        }

        noiseFloorRef.current = updateNoiseFloor(noiseFloorRef.current, rms);

        const threshold = getSpeechThreshold(noiseFloorRef.current);

        const voice = isVoiceLevel(rms, threshold);

        if (voice) {
          confirmCountRef.current += 1;
        } else {
          confirmCountRef.current = 0;
        }

        // ====================================================
        // VOICE START
        // ====================================================

        if (confirmCountRef.current >= VOICE_CONFIG.startConfirmBuffers) {
          stopPlayback();

          speechRef.current = true;

          silenceCountRef.current = 0;

          speechDurationRef.current = 0;

          startThresholdRef.current = getSpeechThreshold(noiseFloorRef.current);

          speechChunksRef.current = [...preRollRef.current];

          preRollRef.current = [];

          confirmCountRef.current = 0;

          if (mountedRef.current) {
            setVoiceDetected(true);

            setRecordingReady(false);

            setPlaying(false);

            setActivePlayback(null);

            setPlaybackUri(null);

            setAssistantAudioUri(null);

            setTranscript("");

            setWakeWord(null);

            setAssistantResponse("");

            setDuration(0);

            setMessage(null);
          }

          console.log("VOICE START");

          return;
        }

        return;
      }

      // ======================================================
      // RECORD ACTIVE
      // ======================================================

      speechChunksRef.current.push(data.slice(0));

      speechDurationRef.current += bufferMs;

      if (mountedRef.current) {
        setDuration(Math.round(speechDurationRef.current));
      }

      const stopThreshold = getStopThreshold(startThresholdRef.current);

      const voiceStillActive = isVoiceLevel(rms, stopThreshold);

      if (voiceStillActive) {
        silenceCountRef.current = 0;
      } else {
        silenceCountRef.current += 1;
      }

      // ======================================================
      // MAX LENGTH
      // ======================================================

      if (speechDurationRef.current >= VOICE_CONFIG.maxSpeechMs) {
        finishVoiceRecording(sampleRate, channels);

        return;
      }

      // ======================================================
      // SILENCE
      // ======================================================

      if (silenceCountRef.current >= VOICE_CONFIG.silenceBuffers) {
        finishVoiceRecording(sampleRate, channels);
      }
    },
    [finishVoiceRecording, stopPlayback],
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
  // STREAM STATUS
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
        const permission = await AudioModule.requestRecordingPermissionsAsync();

        if (cancelled || !mountedRef.current) {
          return;
        }

        if (!permission.granted) {
          setMessage("Microphone permission required.");

          Alert.alert(
            "Microphone Permission",
            "Microphone permission allow karo.",
          );

          return;
        }

        await setAudioModeAsync({
          allowsRecording: true,
          playsInSilentMode: true,
          shouldRouteThroughEarpiece: false,
        });

        if (cancelled || !mountedRef.current) {
          return;
        }

        setPermissionGranted(true);

        const currentStream = streamRef.current;

        if (!currentStream) {
          setMessage("Voice sensor available nahi hai.");

          return;
        }

        if (!currentStream.isStreaming) {
          await currentStream.start();
        }

        if (cancelled || !mountedRef.current) {
          return;
        }

        setListening(true);
      } catch (error) {
        console.error("Audio initialization error:", error);

        if (!cancelled && mountedRef.current) {
          setMessage("Voice sensor start nahi ho saka.");
        }
      } finally {
        initializingRef.current = false;
      }
    };

    initialize();

    return () => {
      cancelled = true;

      mountedRef.current = false;

      speechRef.current = false;

      processingRef.current = false;

      finishingRef.current = false;

      playbackActiveRef.current = false;

      pendingPlayRef.current = false;

      speechChunksRef.current = [];

      preRollRef.current = [];

      confirmCountRef.current = 0;

      silenceCountRef.current = 0;

      speechDurationRef.current = 0;

      const recordingUri = recordingUriRef.current;

      const assistantUri = assistantAudioUriRef.current;

      recordingUriRef.current = null;

      assistantAudioUriRef.current = null;

      if (recordingUri) {
        deleteWavFile(recordingUri).catch(() => {});
      }

      if (assistantUri && assistantUri !== recordingUri) {
        deleteWavFile(assistantUri).catch(() => {});
      }
    };
  }, []);

  // ==========================================================
  // START SENSOR
  // ==========================================================

  const startListening = async () => {
    try {
      if (processingRef.current) {
        setMessage("Assistant abhi processing kar raha hai.");

        return;
      }

      setMessage(null);

      const currentStream = streamRef.current;

      if (!currentStream) {
        setMessage("Voice sensor available nahi hai.");

        return;
      }

      if (!permissionGranted) {
        const permission = await AudioModule.requestRecordingPermissionsAsync();

        if (!permission.granted) {
          setMessage("Microphone permission required.");

          return;
        }

        setPermissionGranted(true);
      }

      if (!currentStream.isStreaming) {
        await currentStream.start();
      }

      if (mountedRef.current) {
        setListening(true);
      }
    } catch (error) {
      console.error("Start listening error:", error);

      setMessage("Voice sensor start nahi ho saka.");
    }
  };

  // ==========================================================
  // STOP SENSOR
  // ==========================================================

  const stopListening = async () => {
    try {
      if (speechRef.current) {
        await finishVoiceRecording(sampleRateRef.current, channelsRef.current);
      }

      const currentStream = streamRef.current;

      if (currentStream && currentStream.isStreaming) {
        await currentStream.stop();
      }

      speechRef.current = false;

      confirmCountRef.current = 0;

      silenceCountRef.current = 0;

      speechChunksRef.current = [];

      preRollRef.current = [];

      speechDurationRef.current = 0;

      if (mountedRef.current) {
        setListening(false);
        setVoiceDetected(false);
      }
    } catch (error) {
      console.error("Stop listening error:", error);

      setMessage("Voice sensor stop nahi ho saka.");
    }
  };

  // ==========================================================
  // PLAY USER VOICE
  // ==========================================================

  const playRecording = () => {
    if (!playbackUri) {
      Alert.alert("No Recording", "Pehle voice bolo.");

      return;
    }

    playSource(playbackUri, "user");
  };

  // ==========================================================
  // PLAY JARVIS
  // ==========================================================

  const playAssistantVoice = () => {
    if (!assistantAudioUri) {
      Alert.alert("No Assistant Audio", "JARVIS ki voice available nahi hai.");

      return;
    }

    playSource(assistantAudioUri, "assistant");
  };

  // ==========================================================
  // UI
  // ==========================================================

  return (
    <View style={styles.container}>
      <View style={styles.card}>
        <Text style={styles.title}>Voice Assistant</Text>

        {/* STATUS */}

        <View
          style={[
            styles.statusBox,
            voiceDetected
              ? styles.voiceDetectedBox
              : processing
                ? styles.processingBox
                : listening
                  ? styles.listeningBox
                  : styles.stoppedBox,
          ]}
        >
          <View
            style={[
              styles.dot,
              voiceDetected
                ? styles.voiceDot
                : processing
                  ? styles.processingDot
                  : listening
                    ? styles.listeningDot
                    : styles.stoppedDot,
            ]}
          />

          <Text style={styles.statusText}>
            {voiceDetected
              ? "Voice Detected"
              : processing
                ? "Processing..."
                : listening
                  ? "Listening..."
                  : "Voice Sensor Off"}
          </Text>
        </View>

        {/* INFO */}

        <Text style={styles.info}>
          Clear voice detect hote hi recording automatically start hogi.
        </Text>

        <Text style={styles.info}>
          Wake word: <Text style={styles.bold}>Friday</Text>
        </Text>

        <Text style={styles.format}>PCM • 16 kHz • Mono • Int16</Text>

        {/* WAKE WORD */}

        {wakeWord ? (
          <View style={styles.wakeBox}>
            <Text style={styles.wakeLabel}>Wake Word Detected</Text>

            <Text style={styles.wakeText}>{wakeWord}</Text>
          </View>
        ) : null}

        {/* TRANSCRIPT */}

        {transcript ? (
          <View style={styles.transcriptBox}>
            <Text style={styles.transcriptLabel}>You said</Text>

            <Text style={styles.transcript}>{transcript}</Text>
          </View>
        ) : null}

        {/* JARVIS RESPONSE */}

        {assistantResponse ? (
          <View style={styles.responseBox}>
            <Text style={styles.responseLabel}>JARVIS</Text>

            <Text style={styles.responseText}>{assistantResponse}</Text>
          </View>
        ) : null}

        {/* RECORDING READY */}

        {recordingReady ? (
          <View style={styles.readyBox}>
            <Text style={styles.readyTitle}>Voice recording ready</Text>

            <Text style={styles.readyText}>
              Duration: {Math.round(duration / 100) / 10} sec
            </Text>
          </View>
        ) : null}

        {/* USER VOICE */}

        {recordingReady && !playing && playbackUri ? (
          <Pressable style={styles.playButton} onPress={playRecording}>
            <Text style={styles.playText}>▶ Hear My Voice</Text>
          </Pressable>
        ) : null}

        {/* JARVIS VOICE */}

        {assistantAudioUri && !playing ? (
          <Pressable
            style={styles.assistantButton}
            onPress={playAssistantVoice}
          >
            <Text style={styles.assistantButtonText}>▶ Hear JARVIS</Text>
          </Pressable>
        ) : null}

        {/* STOP PLAYBACK */}

        {playing ? (
          <Pressable style={styles.stopPlayButton} onPress={stopPlayback}>
            <Text style={styles.stopPlayText}>■ Stop Playback</Text>
          </Pressable>
        ) : null}

        {/* SENSOR */}

        {!listening ? (
          <Pressable style={styles.startButton} onPress={startListening}>
            <Text style={styles.startText}>Start Voice Sensor</Text>
          </Pressable>
        ) : (
          <Pressable style={styles.stopButton} onPress={stopListening}>
            <Text style={styles.stopText}>Stop Voice Sensor</Text>
          </Pressable>
        )}

        {/* MESSAGE */}

        {message ? (
          <View style={styles.messageBox}>
            <Text style={styles.messageText}>{message}</Text>
          </View>
        ) : null}
      </View>
    </View>
  );
}

// ============================================================
// STYLES
// ============================================================

const styles = StyleSheet.create({
  container: {
    width: "100%",
  },

  card: {
    backgroundColor: "#fff",
    borderRadius: 20,
    padding: 20,
    borderWidth: 1,
    borderColor: "#e5e7eb",
  },

  title: {
    fontSize: 26,
    fontWeight: "700",
    color: "#111",
    marginBottom: 18,
  },

  statusBox: {
    flexDirection: "row",
    alignItems: "center",
    borderRadius: 14,
    padding: 15,
    marginBottom: 16,
  },

  listeningBox: {
    backgroundColor: "#f0fdf4",
  },

  voiceDetectedBox: {
    backgroundColor: "#fef2f2",
  },

  processingBox: {
    backgroundColor: "#eff6ff",
  },

  stoppedBox: {
    backgroundColor: "#f3f4f6",
  },

  dot: {
    width: 11,
    height: 11,
    borderRadius: 6,
    marginRight: 10,
  },

  listeningDot: {
    backgroundColor: "#16a34a",
  },

  voiceDot: {
    backgroundColor: "#dc2626",
  },

  processingDot: {
    backgroundColor: "#2563eb",
  },

  stoppedDot: {
    backgroundColor: "#6b7280",
  },

  statusText: {
    fontSize: 15,
    fontWeight: "600",
    color: "#111",
  },

  info: {
    fontSize: 14,
    color: "#666",
    lineHeight: 21,
    marginBottom: 5,
  },

  bold: {
    color: "#111",
    fontWeight: "600",
  },

  format: {
    fontSize: 12,
    color: "#999",
    marginTop: 5,
    marginBottom: 18,
  },

  wakeBox: {
    backgroundColor: "#f0fdf4",
    borderRadius: 12,
    padding: 14,
    marginBottom: 12,
  },

  wakeLabel: {
    fontSize: 12,
    color: "#166534",
    marginBottom: 4,
  },

  wakeText: {
    fontSize: 17,
    color: "#14532d",
    fontWeight: "700",
  },

  transcriptBox: {
    backgroundColor: "#f8fafc",
    borderRadius: 12,
    padding: 14,
    marginBottom: 12,
  },

  transcriptLabel: {
    fontSize: 12,
    color: "#777",
    marginBottom: 5,
  },

  transcript: {
    fontSize: 16,
    color: "#111",
    fontWeight: "500",
  },

  responseBox: {
    backgroundColor: "#111",
    borderRadius: 12,
    padding: 14,
    marginBottom: 12,
  },

  responseLabel: {
    fontSize: 11,
    color: "#aaa",
    marginBottom: 5,
    fontWeight: "600",
  },

  responseText: {
    fontSize: 16,
    color: "#fff",
    lineHeight: 23,
  },

  readyBox: {
    backgroundColor: "#f8fafc",
    borderRadius: 12,
    padding: 14,
    marginBottom: 12,
  },

  readyTitle: {
    fontSize: 15,
    fontWeight: "600",
    color: "#111",
  },

  readyText: {
    fontSize: 13,
    color: "#666",
    marginTop: 4,
  },

  playButton: {
    borderWidth: 1,
    borderColor: "#111",
    borderRadius: 14,
    paddingVertical: 16,
    alignItems: "center",
    marginBottom: 12,
  },

  playText: {
    color: "#111",
    fontSize: 16,
    fontWeight: "600",
  },

  assistantButton: {
    backgroundColor: "#111",
    borderRadius: 14,
    paddingVertical: 16,
    alignItems: "center",
    marginBottom: 12,
  },

  assistantButtonText: {
    color: "#fff",
    fontSize: 16,
    fontWeight: "600",
  },

  stopPlayButton: {
    backgroundColor: "#f3f4f6",
    borderRadius: 14,
    paddingVertical: 16,
    alignItems: "center",
    marginBottom: 12,
  },

  stopPlayText: {
    color: "#111",
    fontSize: 16,
    fontWeight: "600",
  },

  startButton: {
    backgroundColor: "#111",
    borderRadius: 14,
    paddingVertical: 16,
    alignItems: "center",
  },

  startText: {
    color: "#fff",
    fontSize: 16,
    fontWeight: "600",
  },

  stopButton: {
    backgroundColor: "#b91c1c",
    borderRadius: 14,
    paddingVertical: 16,
    alignItems: "center",
  },

  stopText: {
    color: "#fff",
    fontSize: 16,
    fontWeight: "600",
  },

  messageBox: {
    marginTop: 14,
    backgroundColor: "#fef2f2",
    borderRadius: 10,
    padding: 12,
  },

  messageText: {
    color: "#991b1b",
    fontSize: 13,
  },
});

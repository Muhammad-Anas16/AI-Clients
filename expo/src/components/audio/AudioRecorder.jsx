import React, { useCallback, useEffect, useRef, useState } from "react";

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

import { AskLlama, transcribeAudio } from "../../axios/api";

import WalkWordDetector from "../../utils/walkWordDetector";

export default function AudioRecorder() {
  // ==========================================
  // UI STATE
  // ==========================================

  const [permissionGranted, setPermissionGranted] = useState(false);

  const [listening, setListening] = useState(false);

  const [voiceDetected, setVoiceDetected] = useState(false);

  const [recordingReady, setRecordingReady] = useState(false);

  const [playing, setPlaying] = useState(false);

  const [processing, setProcessing] = useState(false);

  const [duration, setDuration] = useState(0);

  const [message, setMessage] = useState(null);

  const [playbackUri, setPlaybackUri] = useState(null);

  const [transcript, setTranscript] = useState("");

  const [wakeWord, setWakeWord] = useState(null);

  const [assistantResponse, setAssistantResponse] = useState("");

  // ==========================================
  // LIFECYCLE
  // ==========================================

  const mountedRef = useRef(false);

  const initializingRef = useRef(false);

  const finishingRef = useRef(false);

  // ==========================================
  // STREAM
  // ==========================================

  const streamRef = useRef(null);

  // ==========================================
  // VOICE DETECTION
  // ==========================================

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

  // ==========================================
  // PLAYBACK FILE
  // ==========================================

  const playbackUriRef = useRef(null);

  // ==========================================
  // PLAYER
  // ==========================================

  const player = useAudioPlayer(playbackUri);

  const playerStatus = useAudioPlayerStatus(player);

  // ==========================================
  // PLAYER STATE
  // ==========================================

  useEffect(() => {
    if (!mountedRef.current) {
      return;
    }

    setPlaying(!!playerStatus?.playing);
  }, [playerStatus?.playing]);

  // ==========================================
  // FINISH VOICE RECORDING
  // ==========================================

  const finishVoiceRecording = useCallback(
    async (
      sampleRate = VOICE_CONFIG.sampleRate,
      channels = VOICE_CONFIG.channels,
    ) => {
      if (finishingRef.current || !speechRef.current) {
        return false;
      }

      finishingRef.current = true;

      try {
        // ====================================
        // LOCK VOICE STATE
        // ====================================

        speechRef.current = false;

        confirmCountRef.current = 0;

        silenceCountRef.current = 0;

        // ====================================
        // SNAPSHOT PCM
        // ====================================

        const chunks = [...speechChunksRef.current];

        const recordedDuration = speechDurationRef.current;

        // ====================================
        // CLEAR CURRENT BUFFER
        // ====================================

        speechChunksRef.current = [];

        preRollRef.current = [];

        speechDurationRef.current = 0;

        if (mountedRef.current) {
          setVoiceDetected(false);
          setProcessing(true);
          setMessage(null);
        }

        console.log("VOICE END", Math.round(recordedDuration), "ms");

        // ====================================
        // TOO SHORT
        // ====================================

        if (recordedDuration < VOICE_CONFIG.minSpeechMs) {
          console.log("Voice too short - ignored");

          if (mountedRef.current) {
            setProcessing(false);
            setRecordingReady(false);
            setTranscript("");
            setWakeWord(null);
            setAssistantResponse("");
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

        // ====================================
        // PCM -> WAV
        // ====================================

        const wavBytes = pcmToWav(chunks, sampleRate, channels);

        // ====================================
        // REMOVE OLD PLAYBACK FILE
        // ====================================

        const oldPlayback = playbackUriRef.current;

        if (oldPlayback) {
          await deleteWavFile(oldPlayback);

          playbackUriRef.current = null;
        }

        // ====================================
        // CREATE TWO FILES
        // ====================================

        const [newPlaybackUri, voskUri] = await Promise.all([
          saveWavForPlayback(wavBytes),

          saveWavForVosk(wavBytes),
        ]);

        playbackUriRef.current = newPlaybackUri;
        // ====================================
        // VOSK
        // ====================================

        let voskResult = null;

        try {
          voskResult = await transcribeAudio(voskUri);

          console.log("Vosk Result:", voskResult?.data?.text);
        } finally {
          // Vosk file is temporary
          await deleteWavFile(voskUri);
        }

        // ====================================
        // GET TEXT
        // ====================================

        const text =
          voskResult?.data?.text ||
          voskResult?.text ||
          voskResult?.transcript ||
          "";

        const cleanText = String(text).trim();

        // ====================================
        // WAKE WORD
        // ====================================

        const detectedWakeWord = WalkWordDetector(voskResult);

        if (mountedRef.current) {
          setTranscript(cleanText);

          setWakeWord(detectedWakeWord);
        }

        console.log("Wake Word:", detectedWakeWord);

        // ====================================
        // NO WAKE WORD
        // ====================================

        if (!detectedWakeWord) {
          console.log("No wake word detected");

          if (mountedRef.current) {
            setProcessing(false);
            setRecordingReady(true);
            setPlaybackUri(newPlaybackUri);
            setDuration(Math.round(recordedDuration));

            setMessage("Wake word nahi mili.");
          }

          return true;
        }

        // ====================================
        // LIFECYCLE CHECK
        // ====================================

        if (!mountedRef.current) {
          return false;
        }

        // ====================================
        // WAKE WORD DETECTED
        // ====================================

        console.log(`Wake word "${detectedWakeWord}" detected`);

        // Remove wake word from command
        const command = cleanText
          .replace(new RegExp(`\\b${detectedWakeWord}\\b`, "i"), "")
          .trim();

        // ====================================
        // ASK LLAMA
        // ====================================

        let llamaResponse = null;

        if (command) {
          console.log("User Command:", command);

          llamaResponse = await AskLlama(command);
        } else {
          llamaResponse = await AskLlama(
            `Wake word "${detectedWakeWord}" detected. Give a very short greeting response.`,
          );
        }

        console.log("Llama Response:", llamaResponse?.data?.answer);

        // ====================================
        // EXTRACT LLAMA ANSWER
        // ====================================

        const answer =
          typeof llamaResponse === "string"
            ? llamaResponse
            : llamaResponse?.data?.answer ||
              llamaResponse?.answer ||
              llamaResponse?.data?.text ||
              llamaResponse?.text ||
              "";

        // ====================================
        // FINAL UI
        // ====================================

        if (mountedRef.current) {
          setPlaybackUri(newPlaybackUri);

          setRecordingReady(true);

          setDuration(Math.round(recordedDuration));

          setAssistantResponse(String(answer).trim());

          setProcessing(false);

          setPlaying(false);

          setMessage(answer ? "Assistant ready." : "Wake word detected.");
        }

        return true;
      } catch (error) {
        console.error("Voice processing error:", error);

        if (mountedRef.current) {
          setProcessing(false);
          setRecordingReady(false);

          setMessage(error?.message || "Voice processing failed.");
        }

        return false;
      } finally {
        finishingRef.current = false;
      }
    },
    [],
  );

  // ==========================================
  // AUDIO BUFFER
  // ==========================================

  const handleAudioBuffer = useCallback(
    (buffer) => {
      if (!buffer?.data || !mountedRef.current || finishingRef.current) {
        return;
      }

      const data = buffer.data;

      const sampleRate = buffer.sampleRate || VOICE_CONFIG.sampleRate;

      const channels = buffer.channels || VOICE_CONFIG.channels;

      sampleRateRef.current = sampleRate;

      channelsRef.current = channels;

      const bufferMs = (data.byteLength / 2 / channels / sampleRate) * 1000;

      const rms = getRmsLevel(data);

      // ======================================
      // WAITING
      // ======================================

      if (!speechRef.current) {
        preRollRef.current.push(data.slice(0));

        if (preRollRef.current.length > 4) {
          preRollRef.current.shift();
        }

        // Background noise
        noiseFloorRef.current = updateNoiseFloor(noiseFloorRef.current, rms);

        const threshold = getSpeechThreshold(noiseFloorRef.current);

        const voice = isVoiceLevel(rms, threshold);

        if (voice) {
          confirmCountRef.current += 1;
        } else {
          confirmCountRef.current = 0;
        }

        // ====================================
        // VOICE START
        // ====================================

        if (confirmCountRef.current >= VOICE_CONFIG.startConfirmBuffers) {
          speechRef.current = true;

          silenceCountRef.current = 0;

          speechDurationRef.current = 0;

          startThresholdRef.current = getSpeechThreshold(noiseFloorRef.current);

          speechChunksRef.current = [...preRollRef.current, data.slice(0)];

          preRollRef.current = [];

          confirmCountRef.current = 0;

          if (mountedRef.current) {
            // Stop previous playback
            try {
              player.pause();
            } catch {}

            setVoiceDetected(true);

            setRecordingReady(false);

            setPlaying(false);

            setTranscript("");

            setWakeWord(null);

            setAssistantResponse("");

            setMessage(null);

            setDuration(0);
          }

          console.log("VOICE START");

          return;
        }

        return;
      }

      // ======================================
      // RECORD ACTIVE
      // ======================================

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

      // ======================================
      // MAX LENGTH
      // ======================================

      if (speechDurationRef.current >= VOICE_CONFIG.maxSpeechMs) {
        finishVoiceRecording(sampleRate, channels);

        return;
      }

      // ======================================
      // SILENCE
      // ======================================

      if (silenceCountRef.current >= VOICE_CONFIG.silenceBuffers) {
        finishVoiceRecording(sampleRate, channels);
      }
    },
    [finishVoiceRecording, player],
  );

  // ==========================================
  // AUDIO STREAM
  // ==========================================

  const audioStreamResult = useAudioStream({
    sampleRate: VOICE_CONFIG.sampleRate,

    channels: VOICE_CONFIG.channels,

    encoding: VOICE_CONFIG.encoding,

    onBuffer: handleAudioBuffer,
  });

  const stream = audioStreamResult.stream;

  const isStreaming = audioStreamResult.isStreaming;

  streamRef.current = stream;

  // ==========================================
  // STREAM STATUS
  // ==========================================

  useEffect(() => {
    if (mountedRef.current) {
      setListening(isStreaming);
    }
  }, [isStreaming]);

  // ==========================================
  // INITIALIZE
  // ==========================================

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

      speechChunksRef.current = [];

      preRollRef.current = [];

      confirmCountRef.current = 0;

      silenceCountRef.current = 0;

      speechDurationRef.current = 0;

      // Delete playback file
      const uri = playbackUriRef.current;

      if (uri) {
        deleteWavFile(uri).catch(() => {});

        playbackUriRef.current = null;
      }
    };
  }, []);

  // ==========================================
  // START SENSOR
  // ==========================================

  const startListening = async () => {
    try {
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

      setListening(true);
    } catch (error) {
      console.error("Start listening error:", error);

      setMessage("Voice sensor start nahi ho saka.");
    }
  };

  // ==========================================
  // STOP SENSOR
  // ==========================================

  const stopListening = async () => {
    try {
      const currentStream = streamRef.current;

      // Save active voice first
      if (speechRef.current) {
        await finishVoiceRecording(sampleRateRef.current, channelsRef.current);
      }

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

  // ==========================================
  // PLAY MY VOICE
  // ==========================================

  const playRecording = () => {
    if (!playbackUri) {
      Alert.alert("No Recording", "Pehle voice bolo.");

      return;
    }

    try {
      player.seekTo(0);
      player.play();

      setPlaying(true);
      setMessage(null);
    } catch (error) {
      console.error("Playback error:", error);

      setPlaying(false);

      setMessage("Voice play nahi ho saki.");
    }
  };

  // ==========================================
  // STOP PLAYBACK
  // ==========================================

  const stopPlayback = () => {
    try {
      player.pause();
      player.seekTo(0);

      setPlaying(false);
    } catch (error) {
      console.error("Stop playback error:", error);
    }
  };

  // ==========================================
  // UI
  // ==========================================

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

        <Text style={styles.info}>
          Clear voice detect hote hi recording automatically start hogi.
        </Text>

        <Text style={styles.info}>
          Wake word: <Text style={styles.bold}>Friday</Text>
        </Text>

        <Text style={styles.format}>PCM • 16 kHz • Mono • Int16</Text>

        {/* WAKE WORD */}

        {wakeWord && (
          <View style={styles.wakeBox}>
            <Text style={styles.wakeLabel}>Wake Word Detected</Text>

            <Text style={styles.wakeText}>{wakeWord}</Text>
          </View>
        )}

        {/* TRANSCRIPT */}

        {transcript ? (
          <View style={styles.transcriptBox}>
            <Text style={styles.transcriptLabel}>You said</Text>

            <Text style={styles.transcript}>{transcript}</Text>
          </View>
        ) : null}

        {/* ASSISTANT RESPONSE */}

        {assistantResponse ? (
          <View style={styles.responseBox}>
            <Text style={styles.responseLabel}>JARVIS</Text>

            <Text style={styles.responseText}>{assistantResponse}</Text>
          </View>
        ) : null}

        {/* RECORDING READY */}

        {recordingReady && (
          <View style={styles.readyBox}>
            <Text style={styles.readyTitle}>Voice recording ready</Text>

            <Text style={styles.readyText}>
              Duration: {Math.round(duration / 100) / 10} sec
            </Text>
          </View>
        )}

        {/* PLAY */}

        {recordingReady && !playing && (
          <Pressable style={styles.playButton} onPress={playRecording}>
            <Text style={styles.playText}>▶ Hear My Voice</Text>
          </Pressable>
        )}

        {/* STOP PLAYBACK */}

        {playing && (
          <Pressable style={styles.stopPlayButton} onPress={stopPlayback}>
            <Text style={styles.stopPlayText}>■ Stop Playback</Text>
          </Pressable>
        )}

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

        {message && (
          <View style={styles.messageBox}>
            <Text style={styles.messageText}>{message}</Text>
          </View>
        )}
      </View>
    </View>
  );
}

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

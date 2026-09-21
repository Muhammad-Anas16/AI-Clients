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
} from "../../services/vosk/voiceDetection";

import { pcmToWav } from "../../services/vosk/pcmToWav";
import { saveWavForPlayback } from "../../services/vosk/playPcmRecording";

export default function AudioRecorder() {
  const [permissionGranted, setPermissionGranted] = useState(false);
  const [listening, setListening] = useState(false);
  const [voiceDetected, setVoiceDetected] = useState(false);

  const [recordingReady, setRecordingReady] = useState(false);
  const [playing, setPlaying] = useState(false);

  const [duration, setDuration] = useState(0);
  const [message, setMessage] = useState(null);

  const [playbackUri, setPlaybackUri] = useState(null);

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
  // PLAYER
  // ==========================================

  const player = useAudioPlayer(playbackUri);
  const playerStatus = useAudioPlayerStatus(player);

  // ==========================================
  // PLAYER FINISHED
  // ==========================================

  useEffect(() => {
    if (!mountedRef.current) {
      return;
    }

    if (playerStatus?.didJustFinish) {
      setPlaying(false);
    }
  }, [playerStatus?.didJustFinish]);

  // ==========================================
  // FINISH VOICE
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
        // Stop voice state
        speechRef.current = false;

        confirmCountRef.current = 0;
        silenceCountRef.current = 0;

        // Take snapshot BEFORE clearing
        const chunks = [...speechChunksRef.current];

        const recordedDuration = speechDurationRef.current;

        // Clear captured data
        speechChunksRef.current = [];
        preRollRef.current = [];
        speechDurationRef.current = 0;

        if (mountedRef.current) {
          setVoiceDetected(false);
        }

        console.log(
          "VOICE END",
          "Duration:",
          Math.round(recordedDuration),
          "ms",
          "Chunks:",
          chunks.length,
        );

        // ======================================
        // TOO SHORT
        // ======================================

        if (recordedDuration < VOICE_CONFIG.minSpeechMs) {
          console.log("Voice too short - ignored");

          if (mountedRef.current) {
            setRecordingReady(false);
            setPlaybackUri(null);
            setDuration(0);
          }

          return false;
        }

        if (!chunks.length) {
          console.log("No PCM chunks available");

          return false;
        }

        // ======================================
        // PCM -> WAV Uint8Array
        // ======================================

        const wavBytes = pcmToWav(chunks, sampleRate, channels);

        console.log("WAV bytes created:", wavBytes.length);

        // ======================================
        // SAVE WAV FILE
        // ======================================

        const uri = await saveWavForPlayback(wavBytes);

        console.log("Playback WAV created:", uri);

        if (!mountedRef.current) {
          return false;
        }

        // ======================================
        // SET PLAYBACK SOURCE
        // ======================================

        setPlaybackUri(uri);

        setRecordingReady(true);
        setPlaying(false);

        setDuration(Math.round(recordedDuration));

        setMessage(null);

        return true;
      } catch (error) {
        console.error("Voice finalize error:", error);

        if (mountedRef.current) {
          setRecordingReady(false);

          setMessage("Voice recording ready nahi ho saki.");
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
      // WAITING FOR VOICE
      // ======================================

      if (!speechRef.current) {
        // Pre-roll
        preRollRef.current.push(data.slice(0));

        if (preRollRef.current.length > 4) {
          preRollRef.current.shift();
        }

        // Learn background noise
        noiseFloorRef.current = updateNoiseFloor(noiseFloorRef.current, rms);

        const threshold = getSpeechThreshold(noiseFloorRef.current);

        const voice = isVoiceLevel(rms, threshold);

        if (voice) {
          confirmCountRef.current += 1;
        } else {
          confirmCountRef.current = 0;
        }

        // ==================================
        // VOICE CONFIRMED
        // ==================================

        if (confirmCountRef.current >= VOICE_CONFIG.startConfirmBuffers) {
          speechRef.current = true;

          silenceCountRef.current = 0;
          speechDurationRef.current = 0;

          startThresholdRef.current = getSpeechThreshold(noiseFloorRef.current);

          speechChunksRef.current = [...preRollRef.current, data.slice(0)];

          preRollRef.current = [];
          confirmCountRef.current = 0;

          if (mountedRef.current) {
            setVoiceDetected(true);

            // New recording started
            setRecordingReady(false);
            setPlaybackUri(null);

            setPlaying(false);
            setDuration(0);
            setMessage(null);
          }

          console.log(
            "VOICE START",
            "RMS:",
            rms.toFixed(4),
            "Threshold:",
            startThresholdRef.current.toFixed(4),
          );
        }

        return;
      }

      // ======================================
      // RECORDING ACTIVE
      // ======================================

      speechChunksRef.current.push(data.slice(0));

      speechDurationRef.current += bufferMs;

      if (mountedRef.current) {
        setDuration(Math.round(speechDurationRef.current));
      }

      // ======================================
      // STOP THRESHOLD
      // ======================================

      const stopThreshold = getStopThreshold(startThresholdRef.current);

      const voiceStillActive = isVoiceLevel(rms, stopThreshold);

      if (voiceStillActive) {
        silenceCountRef.current = 0;
      } else {
        silenceCountRef.current += 1;
      }

      // ======================================
      // MAX RECORDING
      // ======================================

      if (speechDurationRef.current >= VOICE_CONFIG.maxSpeechMs) {
        finishVoiceRecording(sampleRate, channels);

        return;
      }

      // ======================================
      // VOICE END
      // ======================================

      if (silenceCountRef.current >= VOICE_CONFIG.silenceBuffers) {
        finishVoiceRecording(sampleRate, channels);
      }
    },
    [finishVoiceRecording],
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

        console.log("Voice sensor started - waiting for clear voice");
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

      console.log("Voice sensor started");
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

      // ======================================
      // SAVE ACTIVE VOICE FIRST
      // ======================================

      if (speechRef.current) {
        await finishVoiceRecording(sampleRateRef.current, channelsRef.current);
      }

      // ======================================
      // STOP STREAM
      // ======================================

      if (currentStream && currentStream.isStreaming) {
        await currentStream.stop();
      }

      // ======================================
      // RESET DETECTION
      // ======================================

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

      console.log("Voice sensor stopped");
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

      console.log("Playing my voice:", playbackUri);
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
                : listening
                  ? styles.listeningDot
                  : styles.stoppedDot,
            ]}
          />

          <Text style={styles.statusText}>
            {voiceDetected
              ? "Voice Detected"
              : listening
                ? "Waiting for your voice..."
                : "Voice Sensor Off"}
          </Text>
        </View>

        <Text style={styles.info}>
          Clear voice detect hote hi recording automatically start hogi.
        </Text>

        <Text style={styles.info}>Halki background noise ignore hogi.</Text>

        <Text style={styles.format}>PCM • 16 kHz • Mono • Int16</Text>

        {/* RECORDING READY */}

        {recordingReady && (
          <View style={styles.readyBox}>
            <Text style={styles.readyTitle}>Your voice is ready</Text>

            <Text style={styles.readyText}>
              Duration: {Math.round(duration / 100) / 10} sec
            </Text>
          </View>
        )}

        {/* HEAR MY VOICE */}

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

  format: {
    fontSize: 12,
    color: "#999",
    marginTop: 5,
    marginBottom: 18,
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

import React, { useCallback, useEffect, useRef, useState } from "react";

import { View, Text, Pressable, StyleSheet, Alert } from "react-native";

import { useAudioStream } from "expo-audio";

import { requestAudioPermission } from "../../services/vosk/audioPermission";

import { startListening, stopListening } from "../../services/vosk/audioStream";

import { detectSpeech } from "../../services/vosk/speechDetection";

export default function AudioRecorder() {
  const [permissionGranted, setPermissionGranted] = useState(false);

  const [voiceDetected, setVoiceDetected] = useState(false);

  const [error, setError] = useState(null);

  const mountedRef = useRef(true);

  const speechRef = useRef(false);

  const silenceCounterRef = useRef(0);

  const noiseFloorRef = useRef(0.008);

  /*
   * Ye callback har PCM audio buffer par chalega.
   *
   * IMPORTANT:
   * Yahan koi file save nahi ho rahi.
   *
   * Isi jagah baad mein:
   *
   * sendToVosk(buffer)
   *
   * lagaya ja sakta hai.
   */
  const handleAudioBuffer = useCallback((buffer) => {
    if (!buffer?.data) {
      return;
    }

    const result = detectSpeech(
      buffer.data,
      Math.max(0.025, noiseFloorRef.current * 2.5),
    );

    const { rms, speech } = result;

    /*
     * Silence ke waqt environment ka
     * noise level slowly calculate karo.
     */
    if (!speech && !speechRef.current) {
      noiseFloorRef.current = noiseFloorRef.current * 0.95 + rms * 0.05;
    }

    /*
     * Voice START
     */
    if (speech) {
      silenceCounterRef.current = 0;

      if (!speechRef.current) {
        speechRef.current = true;

        if (mountedRef.current) {
          setVoiceDetected(true);
        }

        console.log("VOICE DETECTED");
      }

      /*
       * =====================================
       * VOSK AUDIO INPUT
       * =====================================
       *
       * buffer.data = raw PCM ArrayBuffer
       *
       * Example:
       *
       * sendToVosk(buffer.data);
       *
       * Abhi intentionally kuch save nahi kar rahe.
       */
      console.log(
        "Speech audio:",
        rms.toFixed(4),
        "sampleRate:",
        buffer.sampleRate,
      );
    } else if (speechRef.current) {

    /*
     * Voice END
     *
     * Kuch consecutive silent buffers
     * milne ke baad voice segment close.
     */
      silenceCounterRef.current += 1;

      if (silenceCounterRef.current >= 8) {
        speechRef.current = false;

        silenceCounterRef.current = 0;

        if (mountedRef.current) {
          setVoiceDetected(false);
        }

        console.log("VOICE ENDED");
      }
    }
  }, []);

  /*
   * ALWAYS-ON RAW PCM STREAM
   */
  const audioStreamResult = useAudioStream({
    sampleRate: 16000,
    channels: 1,
    encoding: "int16",
    onBuffer: handleAudioBuffer,
  });

  const stream = audioStreamResult.stream;

  const isStreaming = audioStreamResult.isStreaming;

  /*
   * Initialize
   */
  useEffect(() => {
    mountedRef.current = true;

    initialize();

    return () => {
      mountedRef.current = false;

      /*
       * Important:
       * component unmount hone par stream ko
       * safely stop karo.
       */
      if (stream?.isStreaming) {
        stream.stop().catch(() => {});
      }
    };
  }, [stream]);

  const initialize = async () => {
    try {
      setError(null);

      await requestAudioPermission();

      if (!mountedRef.current) {
        return;
      }

      setPermissionGranted(true);

      await startListening(stream);

      console.log("Always listening started");
    } catch (error) {
      console.error("Audio initialization error:", error);

      if (mountedRef.current) {
        setError(error?.message || "Microphone start nahi ho saka.");

        Alert.alert(
          "Microphone Error",
          error?.message ||
            "Microphone permission ya audio stream start nahi ho saka.",
        );
      }
    }
  };

  /*
   * MANUAL STOP
   */
  const handleStop = async () => {
    try {
      await stopListening(stream);

      speechRef.current = false;
      silenceCounterRef.current = 0;

      setVoiceDetected(false);

      console.log("Listening stopped");
    } catch (error) {
      console.error("Stop listening error:", error);
    }
  };

  /*
   * MANUAL START
   */
  const handleStart = async () => {
    try {
      setError(null);

      await startListening(stream);

      console.log("Listening started");
    } catch (error) {
      console.error("Start listening error:", error);
    }
  };

  return (
    <View style={styles.container}>
      <View style={styles.card}>
        <Text style={styles.title}>Voice Assistant</Text>

        <View
          style={[
            styles.statusBox,
            voiceDetected
              ? styles.voiceActive
              : isStreaming
                ? styles.listening
                : styles.stopped,
          ]}
        >
          <View
            style={[
              styles.dot,
              voiceDetected
                ? styles.voiceDot
                : isStreaming
                  ? styles.listeningDot
                  : styles.stoppedDot,
            ]}
          />

          <Text style={styles.statusText}>
            {voiceDetected
              ? "Voice Detected"
              : isStreaming
                ? "Always Listening..."
                : "Listening Stopped"}
          </Text>
        </View>

        <Text style={styles.info}>
          Microphone continuously listen kar raha hai. Audio file save nahi
          hoti.
        </Text>

        {permissionGranted && (
          <Text style={styles.format}>PCM • 16 kHz • Mono • Int16</Text>
        )}

        {error && (
          <View style={styles.errorBox}>
            <Text style={styles.errorText}>{error}</Text>
          </View>
        )}

        {!isStreaming ? (
          <Pressable style={styles.startButton} onPress={handleStart}>
            <Text style={styles.buttonText}>Start Listening</Text>
          </Pressable>
        ) : (
          <Pressable style={styles.stopButton} onPress={handleStop}>
            <Text style={styles.buttonText}>Stop Listening</Text>
          </Pressable>
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
    padding: 15,
    borderRadius: 14,
    marginBottom: 16,
  },

  listening: {
    backgroundColor: "#f0fdf4",
  },

  voiceActive: {
    backgroundColor: "#fef2f2",
  },

  stopped: {
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
    lineHeight: 21,
    color: "#666",
    marginBottom: 8,
  },

  format: {
    fontSize: 12,
    color: "#999",
    marginBottom: 20,
  },

  errorBox: {
    backgroundColor: "#fef2f2",
    borderRadius: 10,
    padding: 12,
    marginBottom: 15,
  },

  errorText: {
    color: "#b91c1c",
    fontSize: 13,
  },

  startButton: {
    backgroundColor: "#111",
    borderRadius: 14,
    paddingVertical: 16,
    alignItems: "center",
  },

  stopButton: {
    backgroundColor: "#b91c1c",
    borderRadius: 14,
    paddingVertical: 16,
    alignItems: "center",
  },

  buttonText: {
    color: "#fff",
    fontSize: 16,
    fontWeight: "600",
  },
});

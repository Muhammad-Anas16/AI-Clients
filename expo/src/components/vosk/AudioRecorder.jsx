import React, { useCallback, useEffect, useRef, useState } from "react";

import { View, Text, Pressable, StyleSheet, Alert } from "react-native";

import { useAudioStream } from "expo-audio";

import { requestAudioPermission } from "../../services/vosk/audioPermission";

import { startListening, stopListening } from "../../services/vosk/audioStream";

import { detectSpeech } from "../../services/vosk/speechDetection";

import { pcmToWav } from "../../services/vosk/pcmToWav";

import { transcribeAudio } from "../../axios/actions";

export default function AudioRecorder() {
  const [permissionGranted, setPermissionGranted] = useState(false);

  const [voiceDetected, setVoiceDetected] = useState(false);

  const [transcript, setTranscript] = useState("");

  const [processing, setProcessing] = useState(false);

  const [error, setError] = useState(null);

  // ========================================
  // REFS
  // ========================================

  const mountedRef = useRef(true);

  const speechRef = useRef(false);

  const silenceCounterRef = useRef(0);

  const speechChunksRef = useRef([]);

  const preRollRef = useRef([]);

  const sampleRateRef = useRef(16000);

  const channelsRef = useRef(1);

  /*
   * Multiple requests ko order mein
   * process karne ke liye.
   */
  const transcriptionQueueRef = useRef(Promise.resolve());

  // ========================================
  // CONSTANTS
  // ========================================

  const SPEECH_THRESHOLD = 0.025;

  /*
   * Around 250-300ms previous
   * audio keep karenge.
   *
   * Ye sirf RAM mein hai.
   */
  const MAX_PRE_ROLL = 4;

  /*
   * Consecutive silent buffers.
   */
  const SILENCE_BUFFERS = 8;

  // ========================================
  // SEND TO VOSK
  // ========================================

  const sendSpeechToVosk = useCallback((chunks, sampleRate, channels) => {
    if (!chunks || chunks.length === 0) {
      return;
    }

    /*
     * Queue request.
     *
     * Microphone listening band nahi hota.
     */
    transcriptionQueueRef.current = transcriptionQueueRef.current.then(
      async () => {
        try {
          if (mountedRef.current) {
            setProcessing(true);
          }

          // PCM -> WAV Blob
          const wavBlob = pcmToWav(chunks, sampleRate, channels);

          /*
           * Direct server upload.
           *
           * Disk par koi file save nahi.
           */
          const result = await transcribeAudio(wavBlob);

          console.log("Vosk Transcript =>", result);

          /*
           * Common response formats
           */
          const text =
            typeof result === "string"
              ? result
              : result?.text || result?.transcript || "";

          if (mountedRef.current && text) {
            setTranscript(text);
          }
        } catch (error) {
          console.error("Vosk request error:", error);

          if (mountedRef.current) {
            setError(error?.message || "Vosk request failed");
          }
        } finally {
          if (mountedRef.current) {
            setProcessing(false);
          }
        }
      },
    );
  }, []);

  // ========================================
  // AUDIO BUFFER
  // ========================================

  const handleAudioBuffer = useCallback(
    (buffer) => {
      if (!buffer?.data) {
        return;
      }

      /*
       * Actual hardware values use karo.
       */
      sampleRateRef.current = buffer.sampleRate || 16000;

      channelsRef.current = buffer.channels || 1;

      const data = buffer.data;

      const result = detectSpeech(data, SPEECH_THRESHOLD);

      const isSpeech = result.speech;

      // ====================================
      // PRE-ROLL
      // ====================================

      /*
       * Last few buffers RAM mein.
       * Voice start hone par beginning cut nahi hogi.
       */
      if (!speechRef.current) {
        preRollRef.current.push(data.slice(0));

        if (preRollRef.current.length > MAX_PRE_ROLL) {
          preRollRef.current.shift();
        }
      }

      // ====================================
      // SPEECH START
      // ====================================

      if (isSpeech) {
        silenceCounterRef.current = 0;

        if (!speechRef.current) {
          speechRef.current = true;

          /*
           * Pre-roll + current buffer
           */
          speechChunksRef.current = [...preRollRef.current];

          preRollRef.current = [];

          if (mountedRef.current) {
            setVoiceDetected(true);
            setError(null);
          }

          console.log("VOICE START");
        }

        /*
         * Current speech buffer
         */
        speechChunksRef.current.push(data.slice(0));

        return;
      }

      // ====================================
      // SILENCE AFTER SPEECH
      // ====================================

      if (speechRef.current) {
        /*
         * Trailing silence bhi
         * temporarily include kar rahe hain.
         */
        speechChunksRef.current.push(data.slice(0));

        silenceCounterRef.current += 1;

        if (silenceCounterRef.current >= SILENCE_BUFFERS) {
          const chunks = speechChunksRef.current;

          const sampleRate = sampleRateRef.current;

          const channels = channelsRef.current;

          /*
           * IMPORTANT:
           * References immediately clear.
           *
           * Audio permanently save nahi hota.
           */
          speechChunksRef.current = [];

          silenceCounterRef.current = 0;

          speechRef.current = false;

          preRollRef.current = [];

          if (mountedRef.current) {
            setVoiceDetected(false);
          }

          console.log("VOICE END");

          /*
           * Server ko memory se send.
           */
          sendSpeechToVosk(chunks, sampleRate, channels);
        }
      }
    },
    [sendSpeechToVosk],
  );

  // ========================================
  // AUDIO STREAM
  // ========================================

  const audioStreamResult = useAudioStream({
    sampleRate: 16000,
    channels: 1,
    encoding: "int16",
    onBuffer: handleAudioBuffer,
  });

  const stream = audioStreamResult.stream;

  const isStreaming = audioStreamResult.isStreaming;

  // ========================================
  // INITIALIZE
  // ========================================

  useEffect(() => {
    mountedRef.current = true;

    initialize();

    return () => {
      mountedRef.current = false;

      speechRef.current = false;

      speechChunksRef.current = [];

      preRollRef.current = [];

      /*
       * Component unmount:
       * microphone stop.
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
        setError(error?.message || "Microphone error");

        Alert.alert(
          "Microphone Error",
          error?.message || "Microphone start nahi ho saka.",
        );
      }
    }
  };

  // ========================================
  // MANUAL STOP
  // ========================================

  const handleStop = async () => {
    try {
      await stopListening(stream);

      speechRef.current = false;

      speechChunksRef.current = [];

      silenceCounterRef.current = 0;

      if (mountedRef.current) {
        setVoiceDetected(false);
      }
    } catch (error) {
      console.error("Stop listening error:", error);
    }
  };

  // ========================================
  // MANUAL START
  // ========================================

  const handleStart = async () => {
    try {
      setError(null);

      await startListening(stream);
    } catch (error) {
      console.error("Start listening error:", error);
    }
  };

  // ========================================
  // UI
  // ========================================

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
          Microphone continuously listen kar raha hai.
        </Text>

        <Text style={styles.info}>Audio file device par save nahi hoti.</Text>

        <Text style={styles.format}>Live PCM • 16 kHz • Mono • Int16</Text>

        {processing && (
          <View style={styles.processingBox}>
            <Text style={styles.processingText}>Vosk is processing...</Text>
          </View>
        )}

        {transcript ? (
          <View style={styles.transcriptBox}>
            <Text style={styles.transcriptLabel}>Transcript</Text>

            <Text style={styles.transcript}>{transcript}</Text>
          </View>
        ) : null}

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
    marginBottom: 5,
  },

  format: {
    fontSize: 12,
    color: "#999",
    marginTop: 5,
    marginBottom: 18,
  },

  processingBox: {
    backgroundColor: "#eff6ff",
    borderRadius: 10,
    padding: 12,
    marginBottom: 12,
  },

  processingText: {
    color: "#1d4ed8",
    fontSize: 13,
    fontWeight: "600",
  },

  transcriptBox: {
    backgroundColor: "#f9fafb",
    borderRadius: 12,
    padding: 14,
    marginBottom: 15,
  },

  transcriptLabel: {
    fontSize: 12,
    color: "#777",
    marginBottom: 5,
  },

  transcript: {
    fontSize: 17,
    color: "#111",
    fontWeight: "500",
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

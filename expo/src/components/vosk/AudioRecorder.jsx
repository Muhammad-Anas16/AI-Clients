import React, { useEffect, useRef, useState } from "react";
import { View, Text, Pressable, StyleSheet, Alert } from "react-native";

import {
  RecordingPresets,
  useAudioRecorder,
  useAudioRecorderState,
  useAudioPlayer,
} from "expo-audio";

import { requestAudioPermission } from "../../services/vosk/audioPermission";
import { startRecording } from "../../services/vosk/recordAudio";
import { stopRecording } from "../../services/vosk/stopRecording";
import { playRecording, stopPlayback } from "../../services/vosk/playRecording";

export default function AudioRecorder() {
  const [recordingUri, setRecordingUri] = useState(null);
  const [ready, setReady] = useState(false);
  const [error, setError] = useState(null);

  const initializedRef = useRef(false);
  const mountedRef = useRef(true);

  const recorder = useAudioRecorder(RecordingPresets.HIGH_QUALITY);

  const recorderState = useAudioRecorderState(recorder);

  const player = useAudioPlayer(recordingUri);

  useEffect(() => {
    mountedRef.current = true;

    initializeRecorder();

    return () => {
      // IMPORTANT:
      // Yahan recorder.stop() mat karo.
      // useAudioRecorder apna lifecycle khud manage karta hai.
      mountedRef.current = false;
    };
  }, []);

  const initializeRecorder = async () => {
    if (initializedRef.current) {
      return;
    }

    initializedRef.current = true;

    try {
      setError(null);

      await requestAudioPermission();

      if (!mountedRef.current) {
        return;
      }

      setReady(true);

      await startRecording(recorder);

      console.log("Always listening started");
    } catch (error) {
      initializedRef.current = false;

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

  // =========================================
  // START RECORDING
  // =========================================

  const handleStart = async () => {
    try {
      if (recorderState.isRecording) {
        return;
      }

      setError(null);

      await startRecording(recorder);

      console.log("Recording started");
    } catch (error) {
      console.error("Start recording error:", error);

      Alert.alert("Error", "Recording start nahi ho saki.");
    }
  };

  // =========================================
  // STOP RECORDING
  // =========================================

  const handleStop = async () => {
    try {
      if (!recorderState.isRecording) {
        return;
      }

      const uri = await stopRecording(recorder);

      console.log("Recording stopped:", uri);

      if (mountedRef.current && uri) {
        setRecordingUri(uri);
      }
    } catch (error) {
      console.error("Stop recording error:", error);

      Alert.alert("Error", "Recording stop nahi ho saki.");
    }
  };

  // =========================================
  // PLAY
  // =========================================

  const handlePlay = () => {
    if (!recordingUri) {
      Alert.alert("No Recording", "Pehle recording stop karo.");
      return;
    }

    try {
      playRecording(player);
    } catch (error) {
      console.error("Playback error:", error);

      Alert.alert("Playback Error", "Voice play nahi ho saki.");
    }
  };

  // =========================================
  // STOP PLAYBACK
  // =========================================

  const handleStopPlayback = () => {
    try {
      stopPlayback(player);
    } catch (error) {
      console.error("Stop playback error:", error);
    }
  };

  return (
    <View style={styles.container}>
      <View style={styles.card}>
        <Text style={styles.title}>Voice Assistant</Text>

        <View
          style={[
            styles.statusContainer,
            recorderState.isRecording ? styles.listening : styles.stopped,
          ]}
        >
          <View
            style={[
              styles.statusDot,
              recorderState.isRecording ? styles.redDot : styles.grayDot,
            ]}
          />

          <Text style={styles.statusText}>
            {recorderState.isRecording
              ? "Always Listening..."
              : ready
                ? "Listening Stopped"
                : "Initializing..."}
          </Text>
        </View>

        <Text style={styles.duration}>
          Recording Time:{" "}
          {Math.floor((recorderState.durationMillis || 0) / 1000)} sec
        </Text>

        {error && (
          <View style={styles.errorBox}>
            <Text style={styles.errorText}>{error}</Text>
          </View>
        )}

        {recorderState.isRecording ? (
          <Pressable style={styles.stopButton} onPress={handleStop}>
            <Text style={styles.buttonText}>Stop Recording</Text>
          </Pressable>
        ) : (
          <Pressable style={styles.recordButton} onPress={handleStart}>
            <Text style={styles.buttonText}>Start Listening</Text>
          </Pressable>
        )}

        <Pressable style={styles.secondaryButton} onPress={handlePlay}>
          <Text style={styles.secondaryText}>▶ Play My Voice</Text>
        </Pressable>

        <Pressable style={styles.secondaryButton} onPress={handleStopPlayback}>
          <Text style={styles.secondaryText}>■ Stop Playback</Text>
        </Pressable>

        {recordingUri && (
          <View style={styles.fileBox}>
            <Text style={styles.fileLabel}>Last Recording</Text>

            <Text style={styles.fileText} numberOfLines={2}>
              {recordingUri}
            </Text>
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

  statusContainer: {
    flexDirection: "row",
    alignItems: "center",
    padding: 14,
    borderRadius: 12,
    marginBottom: 14,
  },

  listening: {
    backgroundColor: "#fef2f2",
  },

  stopped: {
    backgroundColor: "#f3f4f6",
  },

  statusDot: {
    width: 10,
    height: 10,
    borderRadius: 5,
    marginRight: 10,
  },

  redDot: {
    backgroundColor: "#dc2626",
  },

  grayDot: {
    backgroundColor: "#6b7280",
  },

  statusText: {
    fontSize: 15,
    fontWeight: "600",
    color: "#111",
  },

  duration: {
    fontSize: 14,
    color: "#666",
    marginBottom: 18,
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

  recordButton: {
    backgroundColor: "#111",
    borderRadius: 14,
    paddingVertical: 16,
    alignItems: "center",
    marginBottom: 12,
  },

  stopButton: {
    backgroundColor: "#b91c1c",
    borderRadius: 14,
    paddingVertical: 16,
    alignItems: "center",
    marginBottom: 12,
  },

  buttonText: {
    color: "#fff",
    fontSize: 16,
    fontWeight: "600",
  },

  secondaryButton: {
    borderWidth: 1,
    borderColor: "#d1d5db",
    borderRadius: 14,
    paddingVertical: 16,
    alignItems: "center",
    marginBottom: 12,
  },

  secondaryText: {
    color: "#111",
    fontSize: 16,
    fontWeight: "600",
  },

  fileBox: {
    backgroundColor: "#f9fafb",
    borderRadius: 12,
    padding: 12,
    marginTop: 5,
  },

  fileLabel: {
    fontSize: 12,
    color: "#777",
    marginBottom: 5,
  },

  fileText: {
    fontSize: 12,
    color: "#444",
  },
});

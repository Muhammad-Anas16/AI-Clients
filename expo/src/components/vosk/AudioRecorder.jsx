import React, { useEffect, useState } from "react";
import { View, Text, Pressable, StyleSheet, Alert } from "react-native";

import {
  AudioModule,
  RecordingPresets,
  setAudioModeAsync,
  useAudioRecorder,
  useAudioRecorderState,
  useAudioPlayer,
} from "expo-audio";

export default function AudioRecorder() {
  const [recordingUri, setRecordingUri] = useState(null);

  const [playing, setPlaying] = useState(false);

  const recorder = useAudioRecorder(RecordingPresets.HIGH_QUALITY);

  const recorderState = useAudioRecorderState(recorder);

  const player = useAudioPlayer(recordingUri);

  // ==========================================
  // MICROPHONE PERMISSION
  // ==========================================

  useEffect(() => {
    requestPermission();
  }, []);

  const requestPermission = async () => {
    try {
      const permission = await AudioModule.requestRecordingPermissionsAsync();

      if (!permission.granted) {
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
    } catch (error) {
      console.error("Microphone permission error:", error);
    }
  };

  // ==========================================
  // START RECORDING
  // ==========================================

  const startRecording = async () => {
    try {
      setRecordingUri(null);

      await recorder.prepareToRecordAsync();

      recorder.record();

      console.log("Recording started...");
    } catch (error) {
      console.error("Start recording error:", error);

      Alert.alert("Error", "Recording start nahi ho saki.");
    }
  };

  // ==========================================
  // STOP RECORDING
  // ==========================================

  const stopRecording = async () => {
    try {
      await recorder.stop();

      const uri = recorder.uri;

      if (uri) {
        setRecordingUri(uri);

        console.log("Recording ready:", uri);
      }
    } catch (error) {
      console.error("Stop recording error:", error);

      Alert.alert("Error", "Recording stop nahi ho saki.");
    }
  };

  // ==========================================
  // PLAY
  // ==========================================

  const playRecording = () => {
    if (!recordingUri) {
      Alert.alert("No Recording", "Pehle voice record karo.");

      return;
    }

    try {
      player.seekTo(0);

      player.play();

      setPlaying(true);

      console.log("Playing recording...");
    } catch (error) {
      console.error("Playback error:", error);
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
        <Text style={styles.title}>Voice Recorder</Text>

        <Text style={styles.status}>
          {recorderState.isRecording
            ? "🔴 Recording..."
            : playing
              ? "▶ Playing..."
              : recordingUri
                ? "Recording ready"
                : "Ready"}
        </Text>

        <Text style={styles.duration}>
          {Math.floor((recorderState.durationMillis || 0) / 1000)} sec
        </Text>

        {!recorderState.isRecording ? (
          <Pressable style={styles.recordButton} onPress={startRecording}>
            <Text style={styles.buttonText}>🎤 Start Recording</Text>
          </Pressable>
        ) : (
          <Pressable style={styles.stopButton} onPress={stopRecording}>
            <Text style={styles.buttonText}>⏹ Stop Recording</Text>
          </Pressable>
        )}

        {recordingUri && !recorderState.isRecording && (
          <>
            {!playing ? (
              <Pressable style={styles.playButton} onPress={playRecording}>
                <Text style={styles.playText}>▶ Play My Voice</Text>
              </Pressable>
            ) : (
              <Pressable style={styles.stopPlayButton} onPress={stopPlayback}>
                <Text style={styles.stopPlayText}>■ Stop Playback</Text>
              </Pressable>
            )}
          </>
        )}

        {recordingUri && (
          <Text style={styles.readyText}>Voice recording ready</Text>
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
    marginBottom: 10,
  },

  status: {
    fontSize: 16,
    color: "#555",
    marginBottom: 8,
  },

  duration: {
    fontSize: 14,
    color: "#888",
    marginBottom: 18,
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

  playButton: {
    borderWidth: 1,
    borderColor: "#d1d5db",
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

  readyText: {
    textAlign: "center",
    color: "#777",
    fontSize: 13,
    marginTop: 4,
  },
});

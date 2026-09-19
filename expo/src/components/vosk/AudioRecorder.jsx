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
  const recorder = useAudioRecorder(RecordingPresets.HIGH_QUALITY);
  const recorderState = useAudioRecorderState(recorder);
  const player = useAudioPlayer(recordingUri);

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
      console.error("Audio permission error:", error);
    }
  };

  const startRecording = async () => {
    try {
      setRecordingUri(null);

      await recorder.prepareToRecordAsync();
      recorder.record();
    } catch (error) {
      console.error("Start recording error:", error);

      Alert.alert("Error", "Recording start nahi ho saki.");
    }
  };

  const stopRecording = async () => {
    try {
      await recorder.stop();

      const uri = recorder.uri;

      if (uri) {
        setRecordingUri(uri);
      }
    } catch (error) {
      console.error("Stop recording error:", error);

      Alert.alert("Error", "Recording stop nahi ho saki.");
    }
  };

  const playRecording = () => {
    if (!recordingUri) {
      Alert.alert("No Recording", "Pehle voice record karo.");
      return;
    }

    player.seekTo(0);
    player.play();
  };

  const stopPlayback = () => {
    player.pause();
  };

  return (
    <View style={styles.container}>
      <View style={styles.card}>
        <Text style={styles.title}>Voice Recorder</Text>

        <Text style={styles.status}>
          {recorderState.isRecording
            ? "🔴 Recording..."
            : recordingUri
              ? "Recording ready"
              : "Ready to record"}
        </Text>

        <Pressable
          style={[
            styles.primaryButton,
            recorderState.isRecording && styles.stopButton,
          ]}
          onPress={recorderState.isRecording ? stopRecording : startRecording}
        >
          <Text style={styles.buttonText}>
            {recorderState.isRecording ? "Stop Recording" : "Start Recording"}
          </Text>
        </Pressable>

        <Pressable style={styles.secondaryButton} onPress={playRecording}>
          <Text style={styles.secondaryText}>▶ Play My Voice</Text>
        </Pressable>

        <Pressable style={styles.secondaryButton} onPress={stopPlayback}>
          <Text style={styles.secondaryText}>■ Stop Playback</Text>
        </Pressable>

        {recordingUri && (
          <Text style={styles.uri} numberOfLines={2}>
            {recordingUri}
          </Text>
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
    marginBottom: 8,
  },

  status: {
    fontSize: 15,
    color: "#666",
    marginBottom: 20,
  },

  primaryButton: {
    backgroundColor: "#111",
    borderRadius: 14,
    paddingVertical: 16,
    alignItems: "center",
    marginBottom: 12,
  },

  stopButton: {
    backgroundColor: "#b91c1c",
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

  uri: {
    marginTop: 8,
    fontSize: 12,
    color: "#777",
  },
});

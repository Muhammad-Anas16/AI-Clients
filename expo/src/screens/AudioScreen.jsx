import React from "react";

import { View, Text, StyleSheet, ScrollView } from "react-native";

import AudioRecorder from "../components/vosk/AudioRecorder";
import BottomNavigation from "../components/BottomNavigation";

export default function AudioScreen() {
  return (
    <View style={styles.container}>
      <ScrollView
        contentContainerStyle={styles.content}
        showsVerticalScrollIndicator={false}
      >
        <Text style={styles.heading}>Voice Assistant</Text>

        <Text style={styles.subtitle}>Always listening for your voice</Text>

        <AudioRecorder />
      </ScrollView>

      <BottomNavigation />
    </View>
  );
}

const styles = StyleSheet.create({
  container: {
    flex: 1,
    backgroundColor: "#f9fafb",
  },

  content: {
    padding: 20,
    paddingTop: 50,
    paddingBottom: 30,
  },

  heading: {
    fontSize: 32,
    fontWeight: "700",
    color: "#111",
  },

  subtitle: {
    fontSize: 15,
    color: "#666",
    marginTop: 6,
    marginBottom: 25,
  },
});

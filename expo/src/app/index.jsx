import React, { useEffect } from "react";

import { View, Text, StyleSheet, Button, Alert } from "react-native";

import { router } from "expo-router";

import BottomNavigation from "../components/BottomNavigation";

import {
  getIp,
  checkServerStatus,
  checkVoskStatus,
  checkPiperStatus,
} from "../axios/api";

export default function Index() {
  useEffect(() => {
    checkConnection();
  }, []);

  const checkConnection = async () => {
    try {
      const url = await getIp();
      if (!url) {
        Alert.alert("Server Connection", "Server is not connected.");
        return;
      }

      // SERVER
      const server = await checkServerStatus();
      if (!server?.success) {
        Alert.alert("Server Connection", "Server is not connected.");
        return;
      }
      console.log("Server is Connected");

      // VOSK
      const vosk = await checkVoskStatus();
      console.log(
        vosk?.success ? "Vosk is Connected" : "Vosk is not connected",
      );
      // PIPER
      const piper = await checkPiperStatus();

      console.log(
        piper?.success ? "Piper is Connected" : "Piper is not connected",
      );
    } catch (error) {
      Alert.alert("Connection", "Server is not connected.");
    }
  };

  return (
    <View style={styles.container}>
      <View style={styles.content}>
        <Text style={styles.title}>Hello World</Text>

        <Text style={styles.subtitle}>AI Client App</Text>

        <Button
          title="Go to Settings"
          onPress={() => router.push("/settings")}
        />
      </View>

      <BottomNavigation />
    </View>
  );
}

const styles = StyleSheet.create({
  container: {
    flex: 1,
    backgroundColor: "#fff",
  },

  content: {
    flex: 1,
    alignItems: "center",
    justifyContent: "center",
    gap: 15,
  },

  title: {
    fontSize: 28,
    fontWeight: "700",
  },

  subtitle: {
    fontSize: 16,
    color: "#666",
  },
});

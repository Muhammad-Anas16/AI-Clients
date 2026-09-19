import React, { useEffect, useState } from "react";
import { View, Text, TextInput, Button, Alert, StyleSheet } from "react-native";
import { router } from "expo-router";
import { saveServerIP, getServerIP, deleteServerIP } from "../utils/ipStorage";
import { getIp } from "@/axios/api";
import BottomNavigation from "../components/BottomNavigation";

export default function SettingsScreen() {
  const [ip, setIp] = useState("");

  useEffect(() => {
    loadIP();
  }, []);

  const loadIP = async () => {
    try {
      const savedIP = await getServerIP();

      if (savedIP) {
        setIp(savedIP);
        await getIp();
      }
    } catch (error) {
      console.error("Load IP error:", error);
    }
  };

  const handleSave = async () => {
    if (!ip.trim()) {
      Alert.alert("Error", "IP enter karo");
      return;
    }

    const saved = await saveServerIP(ip.trim());

    if (saved) {
      Alert.alert("Success", "IP save ho gayi");
    }
  };

  const handleDelete = async () => {
    await deleteServerIP();
    setIp("");

    Alert.alert("Success", "IP delete ho gayi");
  };

  return (
    <View style={styles.container}>
      <View style={styles.content}>
        <Text style={styles.title}>Settings</Text>

        <Text style={styles.label}>Server IP</Text>

        <TextInput
          value={ip}
          onChangeText={setIp}
          placeholder="192.168.1.100"
          autoCapitalize="none"
          autoCorrect={false}
          style={styles.input}
        />

        <View style={styles.button}>
          <Button title="Save IP" onPress={handleSave} />
        </View>

        <View style={styles.button}>
          <Button title="Delete IP" onPress={handleDelete} />
        </View>

        <View style={styles.button}>
          <Button title="Back to Home" onPress={() => router.replace("/")} />
        </View>
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
    padding: 20,
    justifyContent: "center",
  },

  title: {
    fontSize: 28,
    fontWeight: "700",
    marginBottom: 30,
  },

  label: {
    fontSize: 16,
    marginBottom: 8,
  },

  input: {
    borderWidth: 1,
    borderColor: "#ccc",
    padding: 12,
    borderRadius: 8,
    fontSize: 16,
    marginBottom: 15,
  },

  button: {
    marginBottom: 10,
  },
});

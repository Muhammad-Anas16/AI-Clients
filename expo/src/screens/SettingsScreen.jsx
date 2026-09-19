import React, { useEffect, useState } from "react";
import {
  View,
  Text,
  TextInput,
  Pressable,
  Alert,
  StyleSheet,
  ScrollView,
} from "react-native";

import {
  saveServerConfig,
  getServerIP,
  getServerPort,
  deleteServerConfig,
  saveTheme,
  getTheme,
  getServerURL,
} from "../utils/ipStorage";

import IpAddressInput from "../components/IpAddressInput";
import ThemeSelector from "../components/ThemeSelector";
import BottomNavigation from "../components/BottomNavigation";

export default function SettingsScreen() {
  const [ipParts, setIpParts] = useState(["", "", "", ""]);
  const [port, setPort] = useState("3000");
  const [theme, setTheme] = useState("system");
  const [serverURL, setServerURL] = useState("");

  useEffect(() => {
    loadSettings();
  }, []);

  const loadSettings = async () => {
    try {
      const savedIP = await getServerIP();
      const savedPort = await getServerPort();
      const savedTheme = await getTheme();
      const savedURL = await getServerURL();

      if (savedIP) {
        setIpParts(savedIP.split("."));
      }

      if (savedPort) {
        setPort(savedPort);
      }

      if (savedTheme) {
        setTheme(savedTheme);
      }

      if (savedURL) {
        setServerURL(savedURL);
      }
    } catch (error) {
      console.error("Load settings error:", error);
    }
  };

  const handleThemeChange = async (value) => {
    setTheme(value);
    await saveTheme(value);
  };

  const handleSave = async () => {
    const validIP =
      ipParts.length === 4 &&
      ipParts.every(
        (part) => part !== "" && Number(part) >= 0 && Number(part) <= 255,
      );

    const validPort = port !== "" && Number(port) >= 1 && Number(port) <= 65535;

    if (!validIP) {
      Alert.alert("Invalid IP", "Complete valid IP enter karo.");
      return;
    }

    if (!validPort) {
      Alert.alert("Invalid Port", "Port 1 se 65535 ke darmiyan hona chahiye.");
      return;
    }

    const ip = ipParts.join(".");
    const saved = await saveServerConfig(ip, port);

    if (saved) {
      const url = `http://${ip}:${port}`;
      setServerURL(url);

      Alert.alert("Success", `Server save ho gaya:\n${url}`);
    }
  };

  const handleDelete = async () => {
    await deleteServerConfig();

    setIpParts(["", "", "", ""]);
    setPort("3000");
    setServerURL("");

    Alert.alert("Success", "Server settings delete ho gayi.");
  };

  const isDark = theme === "dark";

  const colors = {
    background: isDark ? "#0b0b0b" : "#ffffff",
    card: isDark ? "#171717" : "#f8f8f8",
    text: isDark ? "#ffffff" : "#111111",
    secondary: isDark ? "#a1a1aa" : "#666666",
    border: isDark ? "#333333" : "#dddddd",
    input: isDark ? "#1f1f1f" : "#f8fafc",
  };

  return (
    <View style={[styles.container, { backgroundColor: colors.background }]}>
      <ScrollView
        contentContainerStyle={styles.scroll}
        showsVerticalScrollIndicator={false}
      >
        <Text style={[styles.title, { color: colors.text }]}>Settings</Text>

        <Text style={[styles.subtitle, { color: colors.secondary }]}>
          Configure your server connection
        </Text>

        <View
          style={[
            styles.card,
            {
              backgroundColor: colors.card,
              borderColor: colors.border,
            },
          ]}
        >
          <Text style={[styles.label, { color: colors.text }]}>Server IP</Text>

          <IpAddressInput values={ipParts} setValues={setIpParts} />

          <Text style={[styles.label, { color: colors.text }]}>Port</Text>

          <TextInput
            value={port}
            onChangeText={(text) =>
              setPort(text.replace(/[^0-9]/g, "").slice(0, 5))
            }
            keyboardType="number-pad"
            maxLength={5}
            placeholder="3000"
            placeholderTextColor={colors.secondary}
            style={[
              styles.portInput,
              {
                color: colors.text,
                backgroundColor: colors.input,
                borderColor: colors.border,
              },
            ]}
          />

          {serverURL ? (
            <View style={[styles.urlBox, { borderColor: colors.border }]}>
              <Text style={[styles.urlLabel, { color: colors.secondary }]}>
                Current Server
              </Text>

              <Text style={[styles.url, { color: colors.text }]}>
                {serverURL}
              </Text>
            </View>
          ) : null}

          <Pressable onPress={handleSave} style={styles.saveButton}>
            <Text style={styles.saveText}>Save Server</Text>
          </Pressable>

          <Pressable
            onPress={handleDelete}
            style={[styles.deleteButton, { borderColor: colors.border }]}
          >
            <Text style={[styles.deleteText, { color: colors.text }]}>
              Delete Server
            </Text>
          </Pressable>
        </View>

        <View
          style={[
            styles.card,
            {
              backgroundColor: colors.card,
              borderColor: colors.border,
            },
          ]}
        >
          <ThemeSelector theme={theme} setTheme={handleThemeChange} />
        </View>
      </ScrollView>

      <BottomNavigation />
    </View>
  );
}

const styles = StyleSheet.create({
  container: {
    flex: 1,
  },

  scroll: {
    padding: 20,
    paddingBottom: 30,
  },

  title: {
    fontSize: 30,
    fontWeight: "700",
    marginTop: 20,
  },

  subtitle: {
    fontSize: 14,
    marginTop: 5,
    marginBottom: 25,
  },

  card: {
    borderWidth: 1,
    borderRadius: 18,
    padding: 18,
    marginBottom: 18,
  },

  label: {
    fontSize: 15,
    fontWeight: "600",
    marginBottom: 10,
  },

  portInput: {
    height: 54,
    borderWidth: 1,
    borderRadius: 12,
    paddingHorizontal: 16,
    fontSize: 18,
    marginBottom: 18,
  },

  urlBox: {
    borderWidth: 1,
    borderRadius: 12,
    padding: 14,
    marginBottom: 18,
  },

  urlLabel: {
    fontSize: 12,
    marginBottom: 5,
  },

  url: {
    fontSize: 15,
    fontWeight: "600",
  },

  saveButton: {
    backgroundColor: "#111",
    borderRadius: 12,
    paddingVertical: 15,
    alignItems: "center",
    marginBottom: 10,
  },

  saveText: {
    color: "#fff",
    fontSize: 16,
    fontWeight: "600",
  },

  deleteButton: {
    borderWidth: 1,
    borderRadius: 12,
    paddingVertical: 15,
    alignItems: "center",
  },

  deleteText: {
    fontSize: 16,
    fontWeight: "600",
  },
});

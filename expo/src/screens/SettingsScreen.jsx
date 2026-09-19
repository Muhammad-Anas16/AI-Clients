import { useEffect, useState } from "react";

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
  loadSettings,
  saveServer,
  deleteServer,
  updateTheme,
} from "../services/setting/settingsService";

import IpAddressInput from "../components/IpAddressInput";
import ThemeSelector from "../components/ThemeSelector";
import BottomNavigation from "../components/BottomNavigation";

export default function SettingsScreen() {
  const [ipParts, setIpParts] = useState(["", "", "", ""]);
  const [port, setPort] = useState("");
  const [theme, setTheme] = useState("system");
  const [serverURL, setServerURL] = useState("");
  const [loading, setLoading] = useState(true);

  // ==========================================
  // LOAD SETTINGS
  // ==========================================

  useEffect(() => {
    loadData();
  }, []);

  const loadData = async () => {
    try {
      setLoading(true);

      const settings = await loadSettings();

      setIpParts(settings.ipParts);
      setPort(settings.port);
      setTheme(settings.theme);
      setServerURL(settings.serverURL);
    } catch (error) {
      console.error("Load settings error:", error);
    } finally {
      setLoading(false);
    }
  };

  // ==========================================
  // THEME
  // ==========================================

  const handleThemeChange = async (value) => {
    setTheme(value);

    const saved = await updateTheme(value);

    if (!saved) {
      Alert.alert("Error", "Theme save nahi ho saki.");
    }
  };

  // ==========================================
  // SAVE SERVER
  // ==========================================

  const handleSave = async () => {
    try {
      const result = await saveServer(ipParts, port);

      if (!result.success) {
        Alert.alert(
          result.type === "ip"
            ? "Invalid IP"
            : result.type === "port"
              ? "Invalid Port"
              : "Error",
          result.message,
        );

        return;
      }

      setServerURL(result.url);

      Alert.alert("Success", `Server save ho gaya:\n${result.url}`);
    } catch (error) {
      console.error("Save server error:", error);

      Alert.alert("Error", "Server settings save nahi ho sakin.");
    }
  };

  // ==========================================
  // DELETE SERVER
  // ==========================================

  const handleDelete = async () => {
    try {
      const deleted = await deleteServer();

      if (!deleted) {
        Alert.alert("Error", "Server settings delete nahi ho sakin.");

        return;
      }

      setIpParts(["", "", "", ""]);

      setPort("");
      setServerURL("");

      Alert.alert("Success", "Server settings delete ho gayi.");
    } catch (error) {
      console.error("Delete server error:", error);
    }
  };

  // ==========================================
  // THEME COLORS
  // ==========================================

  const isDark = theme === "dark";

  const colors = {
    background: isDark ? "#0b0b0b" : "#ffffff",
    card: isDark ? "#171717" : "#f8f8f8",
    text: isDark ? "#ffffff" : "#111111",
    secondary: isDark ? "#a1a1aa" : "#666666",
    border: isDark ? "#333333" : "#dddddd",
    input: isDark ? "#1f1f1f" : "#f8fafc",
  };

  // ==========================================
  // UI
  // ==========================================

  return (
    <View
      style={[
        styles.container,
        {
          backgroundColor: colors.background,
        },
      ]}
    >
      <ScrollView
        contentContainerStyle={styles.scroll}
        showsVerticalScrollIndicator={false}
      >
        <Text
          style={[
            styles.title,
            {
              color: colors.text,
            },
          ]}
        >
          Settings
        </Text>

        <Text
          style={[
            styles.subtitle,
            {
              color: colors.secondary,
            },
          ]}
        >
          Configure your server connection
        </Text>

        {/* SERVER CARD */}

        <View
          style={[
            styles.card,
            {
              backgroundColor: colors.card,
              borderColor: colors.border,
            },
          ]}
        >
          <Text
            style={[
              styles.label,
              {
                color: colors.text,
              },
            ]}
          >
            Server IP
          </Text>

          <IpAddressInput values={ipParts} setValues={setIpParts} />

          <Text
            style={[
              styles.label,
              {
                color: colors.text,
              },
            ]}
          >
            Port
          </Text>

          <TextInput
            value={port}
            onChangeText={(text) =>
              setPort(text.replace(/[^0-9]/g, "").slice(0, 5))
            }
            keyboardType="number-pad"
            maxLength={5}
            placeholder=""
            autoCorrect={false}
            style={[
              styles.portInput,
              {
                color: colors.text,

                backgroundColor: colors.input,

                borderColor: colors.border,
              },
            ]}
          />

          {/* SERVER URL */}

          {serverURL ? (
            <View
              style={[
                styles.urlBox,
                {
                  borderColor: colors.border,
                },
              ]}
            >
              <Text
                style={[
                  styles.urlLabel,
                  {
                    color: colors.secondary,
                  },
                ]}
              >
                Server URL
              </Text>

              <Text
                style={[
                  styles.url,
                  {
                    color: colors.text,
                  },
                ]}
                selectable
              >
                {serverURL}
              </Text>
            </View>
          ) : null}

          {/* SAVE */}

          <Pressable
            onPress={handleSave}
            disabled={loading}
            style={({ pressed }) => [
              styles.saveButton,
              pressed && styles.buttonPressed,
            ]}
          >
            <Text style={styles.saveText}>Save Server</Text>
          </Pressable>

          {/* DELETE */}

          <Pressable
            onPress={handleDelete}
            style={({ pressed }) => [
              styles.deleteButton,
              {
                borderColor: colors.border,
              },
              pressed && styles.buttonPressed,
            ]}
          >
            <Text
              style={[
                styles.deleteText,
                {
                  color: colors.text,
                },
              ]}
            >
              Delete Server
            </Text>
          </Pressable>
        </View>

        {/* THEME CARD */}

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

  buttonPressed: {
    opacity: 0.7,
  },
});

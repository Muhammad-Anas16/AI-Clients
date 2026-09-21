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

import { router } from "expo-router";

import {
  loadSettings,
  saveServer,
  deleteServer,
  saveAssistantSettings,
} from "../services/setting/settingsService";

import IpAddressInput from "../components/IpAddressInput";

import ThemeSelector from "../components/ThemeSelector";

import { useTheme } from "../context/ThemeContext";

export default function SettingsScreen() {
  const { theme, setTheme, colors } = useTheme();

  const [ipParts, setIpParts] = useState(["", "", "", ""]);

  const [serverURL, setServerURL] = useState("");

  const [wakeWord, setWakeWord] = useState("");

  const [userName, setUserName] = useState("");

  const [systemPrompt, setSystemPrompt] = useState("");

  const [loading, setLoading] = useState(true);

  const [savingAssistant, setSavingAssistant] = useState(false);

  // ==========================================================
  // LOAD
  // ==========================================================

  useEffect(() => {
    loadData();
  }, []);

  const loadData = async () => {
    try {
      setLoading(true);

      const settings = await loadSettings();

      setIpParts(settings.ipParts);

      setServerURL(settings.serverURL);

      setWakeWord(settings.wakeWord);

      setUserName(settings.userName);

      setSystemPrompt(settings.systemPrompt);
    } catch (error) {
      console.error("Load settings error:", error);
    } finally {
      setLoading(false);
    }
  };

  // ==========================================================
  // SAVE SERVER
  // ==========================================================

  const handleSave = async () => {
    try {
      const result = await saveServer(ipParts);

      if (!result.success) {
        Alert.alert(
          result.type === "ip" ? "Invalid IP" : "Error",
          result.message,
        );

        return;
      }

      setServerURL(result.url);

      Alert.alert("Saved", `Server save ho gaya:\n${result.url}`);
    } catch (error) {
      console.error("Save server error:", error);

      Alert.alert("Error", "Server settings save nahi ho sakin.");
    }
  };

  // ==========================================================
  // DELETE SERVER
  // ==========================================================

  const handleDelete = async () => {
    try {
      const deleted = await deleteServer();

      if (!deleted) {
        Alert.alert("Error", "Server settings delete nahi ho sakin.");

        return;
      }

      setIpParts(["", "", "", ""]);

      setServerURL("");

      Alert.alert("Deleted", "Server settings delete ho gayi.");
    } catch (error) {
      console.error("Delete server error:", error);
    }
  };

  // ==========================================================
  // SAVE ASSISTANT
  // ==========================================================

  const handleSaveAssistant = async () => {
    try {
      if (!wakeWord.trim()) {
        Alert.alert("Wake Word", "Wake word enter karo.");

        return;
      }

      if (!userName.trim()) {
        Alert.alert("User Name", "Apna naam enter karo.");

        return;
      }

      if (!systemPrompt.trim()) {
        Alert.alert("System Prompt", "System prompt enter karo.");

        return;
      }

      setSavingAssistant(true);

      const result = await saveAssistantSettings({
        wakeWord,
        userName,
        systemPrompt,
      });

      if (!result.success) {
        Alert.alert("Error", "Assistant settings save nahi ho sakin.");

        return;
      }

      setWakeWord(result.wakeWord);

      setUserName(result.userName);

      setSystemPrompt(result.systemPrompt);

      Alert.alert("Saved", "Assistant settings save ho gayi.");
    } catch (error) {
      console.error("Save assistant settings error:", error);

      Alert.alert("Error", "Assistant settings save nahi ho sakin.");
    } finally {
      setSavingAssistant(false);
    }
  };

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
        {/* HEADER */}

        <View style={styles.header}>
          <Pressable
            onPress={() => router.back()}
            style={[
              styles.backButton,
              {
                backgroundColor: colors.surface,
                borderColor: colors.border,
              },
            ]}
          >
            <Text
              style={[
                styles.backText,
                {
                  color: colors.text,
                },
              ]}
            >
              ‹
            </Text>
          </Pressable>

          <View style={styles.headerContent}>
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
                  color: colors.muted,
                },
              ]}
            >
              Configure JARVIS
            </Text>
          </View>
        </View>

        {/* ================================================== */}
        {/* SERVER */}
        {/* ================================================== */}

        <View
          style={[
            styles.card,
            {
              backgroundColor: colors.surface,
              borderColor: colors.border,
            },
          ]}
        >
          <Text
            style={[
              styles.sectionTitle,
              {
                color: colors.text,
              },
            ]}
          >
            Server Connection
          </Text>

          <Text
            style={[
              styles.sectionSubtitle,
              {
                color: colors.muted,
              },
            ]}
          >
            Local AI server connection.
          </Text>

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
            Server Port
          </Text>

          <View
            style={[
              styles.fixedPort,
              {
                backgroundColor: colors.input,
                borderColor: colors.border,
              },
            ]}
          >
            <Text
              style={[
                styles.portText,
                {
                  color: colors.text,
                },
              ]}
            >
              3000
            </Text>

            <Text
              style={[
                styles.fixedText,
                {
                  color: colors.muted,
                },
              ]}
            >
              Fixed
            </Text>
          </View>

          {serverURL ? (
            <View
              style={[
                styles.urlBox,
                {
                  backgroundColor: colors.elevated,
                  borderColor: colors.border,
                },
              ]}
            >
              <Text
                style={[
                  styles.urlLabel,
                  {
                    color: colors.muted,
                  },
                ]}
              >
                Server URL
              </Text>

              <Text
                selectable
                style={[
                  styles.url,
                  {
                    color: colors.text,
                  },
                ]}
              >
                {serverURL}
              </Text>
            </View>
          ) : null}

          <Pressable
            onPress={handleSave}
            disabled={loading}
            style={[
              styles.primaryButton,
              {
                backgroundColor: colors.accent,
              },
            ]}
          >
            <Text
              style={[
                styles.primaryText,
                {
                  color: colors.accentText,
                },
              ]}
            >
              Save Server
            </Text>
          </Pressable>

          <Pressable
            onPress={handleDelete}
            style={[
              styles.secondaryButton,
              {
                borderColor: colors.border,
              },
            ]}
          >
            <Text
              style={[
                styles.secondaryText,
                {
                  color: colors.text,
                },
              ]}
            >
              Delete Server
            </Text>
          </Pressable>
        </View>

        {/* ================================================== */}
        {/* ASSISTANT SETUP */}
        {/* ================================================== */}

        <View
          style={[
            styles.card,
            {
              backgroundColor: colors.surface,
              borderColor: colors.border,
            },
          ]}
        >
          <Text
            style={[
              styles.sectionTitle,
              {
                color: colors.text,
              },
            ]}
          >
            Assistant Setup
          </Text>

          <Text
            style={[
              styles.sectionSubtitle,
              {
                color: colors.muted,
              },
            ]}
          >
            Configure how your assistant listens and responds.
          </Text>

          {/* WAKE WORD */}

          <Text
            style={[
              styles.label,
              {
                color: colors.text,
              },
            ]}
          >
            Wake Word
          </Text>

          <TextInput
            value={wakeWord}
            onChangeText={setWakeWord}
            placeholder="Buddy"
            placeholderTextColor={colors.subtle}
            autoCorrect={false}
            autoCapitalize="none"
            style={[
              styles.input,
              {
                backgroundColor: colors.input,
                borderColor: colors.border,
                color: colors.text,
              },
            ]}
          />

          {/* USER NAME */}

          <Text
            style={[
              styles.label,
              {
                color: colors.text,
              },
            ]}
          >
            Mujhe kis naam se bulao?
          </Text>

          <TextInput
            value={userName}
            onChangeText={setUserName}
            placeholder="Boss"
            placeholderTextColor={colors.subtle}
            autoCorrect={false}
            style={[
              styles.input,
              {
                backgroundColor: colors.input,
                borderColor: colors.border,
                color: colors.text,
              },
            ]}
          />

          {/* SYSTEM PROMPT */}

          <Text
            style={[
              styles.label,
              {
                color: colors.text,
              },
            ]}
          >
            System Prompt
          </Text>

          <TextInput
            value={systemPrompt}
            onChangeText={setSystemPrompt}
            placeholder="Assistant personality..."
            placeholderTextColor={colors.subtle}
            multiline
            textAlignVertical="top"
            autoCorrect={false}
            style={[
              styles.promptInput,
              {
                backgroundColor: colors.input,
                borderColor: colors.border,
                color: colors.text,
              },
            ]}
          />

          <Pressable
            onPress={handleSaveAssistant}
            disabled={savingAssistant}
            style={[
              styles.primaryButton,
              {
                backgroundColor: colors.accent,
              },
            ]}
          >
            <Text
              style={[
                styles.primaryText,
                {
                  color: colors.accentText,
                },
              ]}
            >
              {savingAssistant ? "Saving..." : "Save Assistant Setup"}
            </Text>
          </Pressable>
        </View>

        {/* ================================================== */}
        {/* THEME */}
        {/* ================================================== */}

        <View
          style={[
            styles.card,
            {
              backgroundColor: colors.surface,
              borderColor: colors.border,
            },
          ]}
        >
          <ThemeSelector theme={theme} setTheme={setTheme} />
        </View>
      </ScrollView>
    </View>
  );
}

const styles = StyleSheet.create({
  container: {
    flex: 1,
  },

  scroll: {
    padding: 20,
    paddingBottom: 32,
  },

  header: {
    flexDirection: "row",
    alignItems: "center",
    marginBottom: 24,
  },

  backButton: {
    width: 42,
    height: 42,
    borderRadius: 14,
    borderWidth: 1,
    alignItems: "center",
    justifyContent: "center",
    marginRight: 12,
  },

  backText: {
    fontSize: 32,
    lineHeight: 32,
  },

  headerContent: {
    flex: 1,
  },

  title: {
    fontSize: 29,
    fontWeight: "800",
  },

  subtitle: {
    fontSize: 13,
    marginTop: 3,
  },

  card: {
    borderWidth: 1,
    borderRadius: 20,
    padding: 18,
    marginBottom: 16,
  },

  sectionTitle: {
    fontSize: 18,
    fontWeight: "700",
  },

  sectionSubtitle: {
    fontSize: 13,
    lineHeight: 19,
    marginTop: 4,
    marginBottom: 20,
  },

  label: {
    fontSize: 14,
    fontWeight: "700",
    marginBottom: 9,
  },

  input: {
    height: 52,
    borderWidth: 1,
    borderRadius: 13,
    paddingHorizontal: 14,
    fontSize: 15,
    marginBottom: 18,
  },

  promptInput: {
    minHeight: 150,
    borderWidth: 1,
    borderRadius: 13,
    paddingHorizontal: 14,
    paddingVertical: 13,
    fontSize: 14,
    lineHeight: 21,
    marginBottom: 18,
  },

  fixedPort: {
    height: 52,
    borderWidth: 1,
    borderRadius: 13,
    paddingHorizontal: 15,
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "space-between",
    marginBottom: 18,
  },

  portText: {
    fontSize: 17,
    fontWeight: "700",
  },

  fixedText: {
    fontSize: 10,
    fontWeight: "800",
    textTransform: "uppercase",
    letterSpacing: 0.7,
  },

  urlBox: {
    borderWidth: 1,
    borderRadius: 13,
    padding: 14,
    marginBottom: 18,
  },

  urlLabel: {
    fontSize: 10,
    fontWeight: "800",
    letterSpacing: 0.8,
    marginBottom: 6,
  },

  url: {
    fontSize: 14,
    fontWeight: "600",
  },

  primaryButton: {
    borderRadius: 14,
    paddingVertical: 15,
    alignItems: "center",
    marginBottom: 10,
  },

  primaryText: {
    fontSize: 15,
    fontWeight: "700",
  },

  secondaryButton: {
    borderWidth: 1,
    borderRadius: 14,
    paddingVertical: 15,
    alignItems: "center",
  },

  secondaryText: {
    fontSize: 15,
    fontWeight: "700",
  },
});

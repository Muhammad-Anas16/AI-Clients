import { Platform } from "react-native";

import * as SecureStore from "expo-secure-store";

const IP_KEY = "SERVER_IP";

const THEME_KEY = "APP_THEME";

const WAKE_WORD_KEY = "ASSISTANT_WAKE_WORD";

const USER_NAME_KEY = "ASSISTANT_USER_NAME";

const SYSTEM_PROMPT_KEY = "ASSISTANT_SYSTEM_PROMPT";

const FIXED_PORT = "3000";

const isWeb = Platform.OS === "web";

const setValue = async (key, value) => {
  if (isWeb) {
    localStorage.setItem(key, value);

    return;
  }

  await SecureStore.setItemAsync(key, value);
};

const getValue = async (key) => {
  if (isWeb) {
    return localStorage.getItem(key);
  }

  return await SecureStore.getItemAsync(key);
};

const removeValue = async (key) => {
  if (isWeb) {
    localStorage.removeItem(key);

    return;
  }

  await SecureStore.deleteItemAsync(key);
};

// ============================================================
// SERVER
// ============================================================

export const saveServerConfig = async (ip) => {
  try {
    await setValue(IP_KEY, ip);

    return true;
  } catch (error) {
    console.error("Save server config error:", error);

    return false;
  }
};

export const getServerIP = async () => {
  try {
    return await getValue(IP_KEY);
  } catch (error) {
    console.error("Get IP error:", error);

    return null;
  }
};

export const getServerPort = async () => {
  return FIXED_PORT;
};

export const getServerURL = async () => {
  try {
    const ip = await getValue(IP_KEY);

    if (!ip) {
      return null;
    }

    return `http://${ip}:${FIXED_PORT}`;
  } catch (error) {
    console.error("Get server URL error:", error);

    return null;
  }
};

export const deleteServerConfig = async () => {
  try {
    await removeValue(IP_KEY);

    return true;
  } catch (error) {
    console.error("Delete server config error:", error);

    return false;
  }
};

// ============================================================
// THEME
// ============================================================

export const saveTheme = async (theme) => {
  try {
    await setValue(THEME_KEY, theme);

    return true;
  } catch (error) {
    console.error("Save theme error:", error);

    return false;
  }
};

export const getTheme = async () => {
  try {
    return await getValue(THEME_KEY);
  } catch (error) {
    console.error("Get theme error:", error);

    return null;
  }
};

// ============================================================
// ASSISTANT CONFIG
// ============================================================

export const saveWakeWord = async (wakeWord) => {
  try {
    await setValue(WAKE_WORD_KEY, wakeWord);

    return true;
  } catch (error) {
    console.error("Save wake word error:", error);

    return false;
  }
};

export const getWakeWord = async () => {
  try {
    return await getValue(WAKE_WORD_KEY);
  } catch (error) {
    console.error("Get wake word error:", error);

    return null;
  }
};

export const saveUserName = async (userName) => {
  try {
    await setValue(USER_NAME_KEY, userName);

    return true;
  } catch (error) {
    console.error("Save user name error:", error);

    return false;
  }
};

export const getUserName = async () => {
  try {
    return await getValue(USER_NAME_KEY);
  } catch (error) {
    console.error("Get user name error:", error);

    return null;
  }
};

export const saveSystemPrompt = async (systemPrompt) => {
  try {
    await setValue(SYSTEM_PROMPT_KEY, systemPrompt);

    return true;
  } catch (error) {
    console.error("Save system prompt error:", error);

    return false;
  }
};

export const getSystemPrompt = async () => {
  try {
    return await getValue(SYSTEM_PROMPT_KEY);
  } catch (error) {
    console.error("Get system prompt error:", error);

    return null;
  }
};

import { Platform } from "react-native";
import * as SecureStore from "expo-secure-store";

const IP_KEY = "SERVER_IP";
const PORT_KEY = "SERVER_PORT";
const THEME_KEY = "APP_THEME";

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

// SERVER CONFIG
export const saveServerConfig = async (ip, port) => {
  try {
    await setValue(IP_KEY, ip);
    await setValue(PORT_KEY, port);

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
  try {
    return await getValue(PORT_KEY);
  } catch (error) {
    console.error("Get port error:", error);

    return null;
  }
};

// COMPLETE SERVER URL
export const getServerURL = async () => {
  try {
    const ip = await getValue(IP_KEY);
    const port = await getValue(PORT_KEY);

    if (!ip || !port) {
      return null;
    }

    return `http://${ip}:${port}`;
  } catch (error) {
    console.error("Get server URL error:", error);

    return null;
  }
};

// DELETE SERVER CONFIG
export const deleteServerConfig = async () => {
  try {
    await removeValue(IP_KEY);
    await removeValue(PORT_KEY);

    return true;
  } catch (error) {
    console.error("Delete server config error:", error);

    return false;
  }
};

// THEME
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

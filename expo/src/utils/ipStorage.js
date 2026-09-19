import * as SecureStore from "expo-secure-store";

const IP_KEY = "SERVER_IP";
const PORT_KEY = "SERVER_PORT";
const URL_KEY = "SERVER_URL";
const THEME_KEY = "APP_THEME";

export const saveServerConfig = async (ip, port) => {
  try {
    const url = `http://${ip}:${port}`;

    await SecureStore.setItemAsync(IP_KEY, ip);
    await SecureStore.setItemAsync(PORT_KEY, port);
    await SecureStore.setItemAsync(URL_KEY, url);

    return true;
  } catch (error) {
    console.error("Save server config error:", error);
    return false;
  }
};

export const getServerIP = async () => {
  try {
    return await SecureStore.getItemAsync(IP_KEY);
  } catch (error) {
    console.error("Get IP error:", error);
    return null;
  }
};

export const getServerPort = async () => {
  try {
    return await SecureStore.getItemAsync(PORT_KEY);
  } catch (error) {
    console.error("Get port error:", error);
    return null;
  }
};

export const getServerURL = async () => {
  try {
    return await SecureStore.getItemAsync(URL_KEY);
  } catch (error) {
    console.error("Get URL error:", error);
    return null;
  }
};

export const deleteServerConfig = async () => {
  try {
    await SecureStore.deleteItemAsync(IP_KEY);
    await SecureStore.deleteItemAsync(PORT_KEY);
    await SecureStore.deleteItemAsync(URL_KEY);

    return true;
  } catch (error) {
    console.error("Delete server config error:", error);
    return false;
  }
};

export const saveTheme = async (theme) => {
  try {
    await SecureStore.setItemAsync(THEME_KEY, theme);
    return true;
  } catch (error) {
    console.error("Save theme error:", error);
    return false;
  }
};

export const getTheme = async () => {
  try {
    return await SecureStore.getItemAsync(THEME_KEY);
  } catch (error) {
    console.error("Get theme error:", error);
    return null;
  }
};

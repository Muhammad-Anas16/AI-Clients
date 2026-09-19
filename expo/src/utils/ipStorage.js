import * as SecureStore from "expo-secure-store";

const IP_KEY = "SERVER_IP";

export const saveServerIP = async (ip) => {
  try {
    await SecureStore.setItemAsync(IP_KEY, ip);
    return true;
  } catch (error) {
    console.error("Error saving IP:", error);
    return false;
  }
};

export const getServerIP = async () => {
  try {
    return await SecureStore.getItemAsync(IP_KEY);
  } catch (error) {
    console.error("Error getting IP:", error);
    return null;
  }
};

export const deleteServerIP = async () => {
  try {
    await SecureStore.deleteItemAsync(IP_KEY);
    return true;
  } catch (error) {
    console.error("Error deleting IP:", error);
    return false;
  }
};

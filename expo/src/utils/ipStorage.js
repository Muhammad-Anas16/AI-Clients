import * as SecureStore from "expo-secure-store";

const IP_KEY = "SERVER_IP";

// Save IP
export const saveServerIP = async (ip) => {
  try {
    await SecureStore.setItemAsync(IP_KEY, ip);
    return true;
  } catch (error) {
    console.error("Error saving IP:", error);
    return false;
  }
};

// Get IP
export const getServerIP = async () => {
  try {
    const ip = await SecureStore.getItemAsync(IP_KEY);
    return ip;
  } catch (error) {
    console.error("Error getting IP:", error);
    return null;
  }
};

// Delete IP
export const deleteServerIP = async () => {
  try {
    await SecureStore.deleteItemAsync(IP_KEY);
    return true;
  } catch (error) {
    console.error("Error deleting IP:", error);
    return false;
  }
};

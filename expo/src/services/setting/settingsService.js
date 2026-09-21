import {
  saveServerConfig,
  getServerIP,
  getTheme,
  deleteServerConfig,
  getServerURL,
  saveTheme,
  getWakeWord,
  saveWakeWord,
  getUserName,
  saveUserName,
  getSystemPrompt,
  saveSystemPrompt,
} from "../../utils/ipStorage";

import {
  DEFAULT_WAKE_WORD,
  DEFAULT_USER_NAME,
  DEFAULT_SYSTEM_PROMPT,
  normalizeAssistantValue,
} from "../../config/assistantConfig";

const SERVER_PORT = "3000";

// ============================================================
// LOAD ALL SETTINGS
// ============================================================

export const loadSettings = async () => {
  const [ip, theme, url, wakeWord, userName, systemPrompt] = await Promise.all([
    getServerIP(),
    getTheme(),
    getServerURL(),
    getWakeWord(),
    getUserName(),
    getSystemPrompt(),
  ]);

  let ipParts = ["", "", "", ""];

  if (ip) {
    const parts = ip.split(".");

    if (parts.length === 4) {
      ipParts = parts;
    }
  }

  return {
    ipParts,

    port: SERVER_PORT,

    theme: theme === "dark" ? "dark" : "light",

    serverURL: url || "",

    wakeWord: normalizeAssistantValue(wakeWord, DEFAULT_WAKE_WORD),

    userName: normalizeAssistantValue(userName, DEFAULT_USER_NAME),

    systemPrompt: normalizeAssistantValue(systemPrompt, DEFAULT_SYSTEM_PROMPT),
  };
};

// ============================================================
// VALIDATE IP
// ============================================================

export const isValidIP = (ipParts) => {
  return (
    ipParts.length === 4 &&
    ipParts.every(
      (part) => part !== "" && Number(part) >= 0 && Number(part) <= 255,
    )
  );
};

// ============================================================
// BUILD SERVER URL
// ============================================================

export const buildServerURL = (ipParts) => {
  return `http://${ipParts.join(".")}:${SERVER_PORT}`;
};

// ============================================================
// SAVE SERVER
// ============================================================

export const saveServer = async (ipParts) => {
  if (!isValidIP(ipParts)) {
    return {
      success: false,
      type: "ip",
      message: "Complete valid IP enter karo.",
    };
  }

  const ip = ipParts.join(".");

  const saved = await saveServerConfig(ip);

  if (!saved) {
    return {
      success: false,
      type: "storage",
      message: "Server settings save nahi ho sakin.",
    };
  }

  return {
    success: true,
    ip,
    port: SERVER_PORT,
    url: buildServerURL(ipParts),
  };
};

// ============================================================
// DELETE SERVER
// ============================================================

export const deleteServer = async () => {
  return await deleteServerConfig();
};

// ============================================================
// SAVE ASSISTANT SETTINGS
// ============================================================

export const saveAssistantSettings = async ({
  wakeWord,
  userName,
  systemPrompt,
}) => {
  const cleanWakeWord = normalizeAssistantValue(wakeWord, DEFAULT_WAKE_WORD);

  const cleanUserName = normalizeAssistantValue(userName, DEFAULT_USER_NAME);

  const cleanSystemPrompt = normalizeAssistantValue(
    systemPrompt,
    DEFAULT_SYSTEM_PROMPT,
  );

  const [wakeSaved, userSaved, promptSaved] = await Promise.all([
    saveWakeWord(cleanWakeWord),

    saveUserName(cleanUserName),

    saveSystemPrompt(cleanSystemPrompt),
  ]);

  return {
    success: wakeSaved && userSaved && promptSaved,

    wakeWord: cleanWakeWord,

    userName: cleanUserName,

    systemPrompt: cleanSystemPrompt,
  };
};

// ============================================================
// THEME
// ============================================================

export const updateTheme = async (theme) => {
  return await saveTheme(theme);
};

// ============================================================
// CURRENT SERVER URL
// ============================================================

export const getCurrentServerURL = async () => {
  return await getServerURL();
};

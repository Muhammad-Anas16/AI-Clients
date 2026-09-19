import {
  saveServerConfig,
  getServerIP,
  getServerPort,
  deleteServerConfig,
  saveTheme,
  getTheme,
  getServerURL,
} from "../../utils/ipStorage";

// LOAD ALL SETTINGS
export const loadSettings = async () => {
  const [ip, port, theme, url] = await Promise.all([
    getServerIP(),
    getServerPort(),
    getTheme(),
    getServerURL(),
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
    port: port || "",
    theme: theme || "system",
    serverURL: url || "",
  };
};

// VALIDATE IP
export const isValidIP = (ipParts) => {
  return (
    ipParts.length === 4 &&
    ipParts.every(
      (part) => part !== "" && Number(part) >= 0 && Number(part) <= 255,
    )
  );
};

// VALIDATE PORT
export const isValidPort = (port) => {
  if (!port) {
    return false;
  }

  const number = Number(port);

  return number >= 1 && number <= 65535;
};

// CREATE SERVER URL
export const buildServerURL = (ipParts, port) => {
  const ip = ipParts.join(".");

  return `http://${ip}:${port}`;
};

// SAVE SERVER
export const saveServer = async (ipParts, port) => {
  if (!isValidIP(ipParts)) {
    return {
      success: false,
      type: "ip",
      message: "Complete valid IP enter karo.",
    };
  }

  if (!isValidPort(port)) {
    return {
      success: false,
      type: "port",
      message: "Port 1 se 65535 ke darmiyan hona chahiye.",
    };
  }

  const ip = ipParts.join(".");

  const saved = await saveServerConfig(ip, port);

  if (!saved) {
    return {
      success: false,
      type: "storage",
      message: "Server settings save nahi ho sakin.",
    };
  }

  const url = buildServerURL(ipParts, port);

  return {
    success: true,
    ip,
    port,
    url,
  };
};

// DELETE SERVER
export const deleteServer = async () => {
  const deleted = await deleteServerConfig();

  return deleted;
};

// SAVE THEME
export const updateTheme = async (theme) => {
  return await saveTheme(theme);
};

// GET CURRENT SERVER URL
export const getCurrentServerURL = async () => {
  return await getServerURL();
};

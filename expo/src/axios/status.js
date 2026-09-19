import axios from "axios";
import { getIp } from "./api";

// Axios client getter
export const getHttp = async () => {
  const baseURL = await getIp();

  if (!baseURL) {
    throw new Error("Server URL is not configured");
  }

  return axios.create({
    baseURL,
    timeout: 120000,
  });
};

// Server Status
export const checkServerStatus = async () => {
  const http = await getHttp();
  const result = await http.get("/status");
  return result.data;
};

// Vosk Status
export const checkVoskStatus = async () => {
  const http = await getHttp();
  const result = await http.get("/vosk/status");
  return result.data;
};

// Piper Status
export const checkPiperStatus = async () => {
  const http = await getHttp();
  const result = await http.get("/piper/status");
  return result.data;
};

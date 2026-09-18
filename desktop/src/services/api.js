import axios from "axios";

// SERVER CONFIG
export const API_BASE_URL = "http://192.168.1.57:3000/api/";

// Axios client
const http = axios.create({
  baseURL: API_BASE_URL,
  timeout: 120000,
});

export const checkStatus = async () => {
  const result = await http.get("status");
  return result.data;
};

import WebSocket from "ws";
import { config } from "../../config/index.js";

function call(port, payload) {
  return new Promise((resolve, reject) => {
    const socket = new WebSocket(`ws://127.0.0.1:${port}`);
    const timeout = setTimeout(() => { try { socket.close(); } catch {} reject(new Error("PYTHON_SERVICE_TIMEOUT")); }, 120000);
    socket.on("open", () => socket.send(JSON.stringify(payload)));
    socket.on("message", data => {
      clearTimeout(timeout);
      try {
        const response = JSON.parse(data.toString());
        if (response.type === "error") reject(new Error(`${response.code}: ${response.message || ""}`));
        else resolve(response);
      } catch (error) {
        reject(error);
      }
      socket.close();
    });
    socket.on("error", error => { clearTimeout(timeout); reject(error); });
  });
}

export function transcribe(audioBase64, language) {
  return call(config.pythonVoskPort, { action: "transcribe", audio: audioBase64, language });
}

export function speak(text, language) {
  return call(config.pythonPiperPort, { action: "speak", text, language });
}

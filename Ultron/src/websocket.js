import { WebSocketServer } from "ws";
import * as llama from "./services/llm/llama.service.js";
import * as speech from "./services/speech/speech.service.js";
import * as ocr from "./services/ocr/ocr.service.js";

export function attachWebSocket(server) {
  const wss = new WebSocketServer({ server, path: "/ws/jarvis" });
  wss.on("connection", socket => {
    socket.send(JSON.stringify({ type: "ready", server: "jarvis", pipeline: ["listen", "think", "speak", "see"] }));
    socket.on("message", async raw => {
      let request;
      try { request = JSON.parse(raw.toString()); } catch { socket.send(JSON.stringify({ type: "error", code: "INVALID_JSON" })); return; }
      try {
        if (request.type === "chat") {
          const text = await llama.chat(request.message, request);
          socket.send(JSON.stringify({ type: "chat.result", text }));
          return;
        }
        if (request.type === "transcribe") {
          const result = await speech.transcribe(request.audioBase64, request.language || "en-us");
          socket.send(JSON.stringify({ type: "transcribe.result", ...result }));
          return;
        }
        if (request.type === "speak") {
          const result = await speech.speak(request.text, request.language || "en-us");
          socket.send(JSON.stringify({ type: "speak.result", ...result }));
          return;
        }
        if (request.type === "ocr") {
          const buffer = Buffer.from(request.imageBase64 || "", "base64");
          const result = await ocr.recognize(buffer, request.language || "eng");
          socket.send(JSON.stringify({ type: "ocr.result", ...result }));
          return;
        }
        if (request.type === "pipeline") {
          socket.send(JSON.stringify({ type: "pipeline.state", state: "listen" }));
          const transcript = await speech.transcribe(request.audioBase64, request.language || "en-us");
          socket.send(JSON.stringify({ type: "pipeline.transcript", ...transcript }));
          socket.send(JSON.stringify({ type: "pipeline.state", state: "think" }));
          const text = await llama.chat(transcript.text, request);
          socket.send(JSON.stringify({ type: "pipeline.think", text }));
          socket.send(JSON.stringify({ type: "pipeline.state", state: "speak" }));
          const audio = await speech.speak(text, request.language || "en-us");
          socket.send(JSON.stringify({ type: "pipeline.audio", ...audio }));
          socket.send(JSON.stringify({ type: "pipeline.done", text }));
          return;
        }
        socket.send(JSON.stringify({ type: "error", code: "UNKNOWN_MESSAGE_TYPE" }));
      } catch (error) {
        socket.send(JSON.stringify({ type: "error", code: String(error.message || "REQUEST_FAILED") }));
      }
    });
  });
  return wss;
}

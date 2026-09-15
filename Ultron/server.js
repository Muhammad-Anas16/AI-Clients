import http from "node:http";
import express from "express";
import cors from "cors";
import morgan from "morgan";
import path from "node:path";
import { fileURLToPath } from "node:url";
import { config } from "./src/config/index.js";
import { paths } from "./src/config/paths.js";
import { ensureDir } from "./src/utils/fs.js";
import apiRoutes from "./src/routes/api.routes.js";
import { startPythonWorkers, waitForWorkers, shutdownPythonWorkers } from "./src/services/python.service.js";
import * as llama from "./src/services/llm/llama.service.js";
import * as ocr from "./src/services/ocr/ocr.service.js";
import { attachWebSocket } from "./src/websocket.js";

const __dirname = path.dirname(fileURLToPath(import.meta.url));
const app = express();
app.use(cors());
app.use(express.json({ limit: `${Math.ceil(config.maxUploadBytes / 1024 / 1024)}mb` }));
app.use(morgan("dev"));
app.use(express.static(path.join(__dirname, "public")));
app.use("/api", apiRoutes);
app.get("/", (_req, res) => res.sendFile(path.join(__dirname, "public", "index.html")));
app.use((error, _req, res, _next) => {
  const message = error?.message || "INTERNAL_ERROR";
  const code = message.split(":")[0] || "INTERNAL_ERROR";
  res.status(code.startsWith("INVALID") ? 400 : 500).json({ error: code, message });
});

await ensureDir(paths.models);
await ensureDir(paths.llm);
await ensureDir(paths.vosk);
await ensureDir(paths.piper);
await ensureDir(paths.temp);

startPythonWorkers();
const pythonReady = await waitForWorkers();
console.log(`[JARVIS] Python workers: ${pythonReady ? "ready" : "starting/degraded"}`);

const server = http.createServer(app);
attachWebSocket(server);
server.listen(config.port, config.host, () => {
  console.log(`\nJARVIS Master Server listening on http://127.0.0.1:${config.port}`);
  console.log(`WebSocket pipeline: ws://127.0.0.1:${config.port}/ws/jarvis`);
  console.log("Heavy models load only when used.");
});

async function shutdown(signal) {
  console.log(`[JARVIS] ${signal}: shutting down...`);
  await llama.unload();
  await ocr.shutdown();
  await shutdownPythonWorkers();
  server.close(() => process.exit(0));
  setTimeout(() => process.exit(0), 3000).unref();
}
process.on("SIGINT", () => shutdown("SIGINT"));
process.on("SIGTERM", () => shutdown("SIGTERM"));

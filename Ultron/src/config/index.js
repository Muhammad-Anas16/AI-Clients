import "dotenv/config";
import path from "node:path";
import { paths } from "./paths.js";

export const config = {
  host: process.env.JARVIS_HOST || "0.0.0.0",
  port: Number(process.env.JARVIS_PORT || 3000),
  maxUploadBytes: Number(process.env.JARVIS_MAX_UPLOAD_MB || 20) * 1024 * 1024,
  llmModel: process.env.JARVIS_LLM_MODEL || "qwen25-0.5b-q2",
  voskModel: process.env.JARVIS_VOSK_MODEL || "en-us-small",
  piperVoice: process.env.JARVIS_PIPER_VOICE || "en-us-lessac-low",
  llamaContext: Number(process.env.JARVIS_LLAMA_CONTEXT || 512),
  llamaMaxTokens: Number(process.env.JARVIS_LLAMA_MAX_TOKENS || 128),
  llamaThreads: Number(process.env.JARVIS_LLAMA_THREADS || Math.max(1, Math.min(2, Number(process.env.NUMBER_OF_PROCESSORS || 2)))),
  pythonVoskPort: Number(process.env.JARVIS_PYTHON_VOSK_PORT || 8765),
  pythonPiperPort: Number(process.env.JARVIS_PYTHON_PIPER_PORT || 8766),
  pythonVenvPython: process.platform === "win32"
    ? path.join(paths.root, ".venv", "Scripts", "python.exe")
    : path.join(paths.root, ".venv", "bin", "python")
};

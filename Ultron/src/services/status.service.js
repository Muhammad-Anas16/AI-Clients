import os from "node:os";
import { config } from "../config/index.js";
import * as llama from "./llm/llama.service.js";
import { pythonStatus } from "./python.service.js";
import { status as ocrStatus } from "./ocr/ocr.service.js";
import { active } from "./model.service.js";

export async function status() {
  return {
    node: { ok: true, version: process.version },
    python: pythonStatus(),
    llm: llama.status(),
    ocr: ocrStatus(),
    activeModels: await active(),
    memoryMB: Math.round(process.memoryUsage().rss / 1024 / 1024),
    systemFreeMemoryMB: Math.round(os.freemem() / 1024 / 1024),
    uptimeSeconds: Math.round(process.uptime()),
    server: `http://${config.host}:${config.port}`
  };
}

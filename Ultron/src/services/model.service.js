import path from "node:path";
import { fileExists } from "../utils/fs.js";
import { MODEL_REGISTRY } from "../config/models.js";
import { paths } from "../config/paths.js";
import { config } from "../config/index.js";

async function installed(type, item) {
  if (type === "llm") return fileExists(path.join(paths.llm, item.fileName));
  if (type === "vosk") return fileExists(path.join(paths.vosk, item.folder, "conf", "model.conf"));
  if (type === "piper") return fileExists(path.join(paths.piper, item.id, item.modelFile));
  return false;
}

export async function list() {
  const result = {};
  for (const type of Object.keys(MODEL_REGISTRY)) {
    result[type] = [];
    for (const item of MODEL_REGISTRY[type]) result[type].push({ ...item, installed: await installed(type, item) });
  }
  return result;
}

export async function active() {
  return { llm: config.llmModel, vosk: config.voskModel, piper: config.piperVoice };
}

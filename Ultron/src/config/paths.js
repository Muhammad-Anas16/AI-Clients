import path from "node:path";
import { fileURLToPath } from "node:url";

const root = path.resolve(path.dirname(fileURLToPath(import.meta.url)), "../..");

export const paths = {
  root,
  models: path.join(root, "models"),
  llm: path.join(root, "models", "llm"),
  vosk: path.join(root, "models", "vosk"),
  piper: path.join(root, "models", "piper"),
  python: path.join(root, "python"),
  temp: path.join(root, "temp")
};

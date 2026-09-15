import fs from "node:fs/promises";
import path from "node:path";

const files = [
  "package.json",
  "server.js",
  "scripts/install.mjs",
  "src/config/index.js",
  "src/config/models.js",
  "src/config/paths.js",
  "src/routes/api.routes.js",
  "src/websocket.js",
  "src/services/download.service.js",
  "src/services/install.service.js",
  "src/services/python.service.js",
  "src/services/llm/llama.service.js",
  "src/services/speech/python-client.js",
  "src/services/speech/speech.service.js",
  "src/services/ocr/ocr.service.js",
  "python/vosk/service.py",
  "python/piper/service.py"
];
for (let i = 0; i < files.length; i++) {
  await fs.access(path.join(process.cwd(), files[i]));
  console.log(`[CHECK] ${files[i]}`);
}
console.log(`[CHECK] ${files.length}/${files.length} files present.`);

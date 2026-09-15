import path from "node:path";
import { spawn } from "node:child_process";
import WebSocket from "ws";
import { config } from "../config/index.js";
import { paths } from "../config/paths.js";
import { ensureDir } from "../utils/fs.js";

const workers = {};
let shuttingDown = false;

function workerScript(kind) {
  return kind === "vosk" ? path.join(paths.python, "vosk", "service.py") : path.join(paths.python, "piper", "service.py");
}

export function startPythonWorkers() {
  const definitions = [
    ["vosk", config.pythonVoskPort],
    ["piper", config.pythonPiperPort]
  ];
  for (let i = 0; i < definitions.length; i++) {
    const [kind, port] = definitions[i];
    const child = spawn(config.pythonVenvPython, [workerScript(kind), "--host", "127.0.0.1", "--port", String(port)], { cwd: paths.root, stdio: ["ignore", "pipe", "pipe"], windowsHide: true });
    child.stdout.on("data", data => process.stdout.write(`[PYTHON:${kind}] ${data}`));
    child.stderr.on("data", data => process.stderr.write(`[PYTHON:${kind}] ${data}`));
    child.on("exit", code => { if (!shuttingDown) console.error(`[PYTHON:${kind}] exited with code ${code}`); });
    workers[kind] = child;
  }
}

export async function waitForWorkers(timeout = 15000) {
  const started = Date.now();
  while (Date.now() - started < timeout) {
    try {
      const a = await probe(config.pythonVoskPort);
      const b = await probe(config.pythonPiperPort);
      if (a && b) return true;
    } catch {}
    await new Promise(resolve => setTimeout(resolve, 250));
  }
  return false;
}

function probe(port) {
  return new Promise(resolve => {
    const ws = new WebSocket(`ws://127.0.0.1:${port}`);
    const timer = setTimeout(() => { try { ws.close(); } catch {} resolve(false); }, 1200);
    ws.once("open", () => { clearTimeout(timer); ws.close(); resolve(true); });
    ws.once("error", () => { clearTimeout(timer); resolve(false); });
  });
}

export function pythonStatus() {
  return {
    vosk: { running: Boolean(workers.vosk && !workers.vosk.killed), port: config.pythonVoskPort },
    piper: { running: Boolean(workers.piper && !workers.piper.killed), port: config.pythonPiperPort }
  };
}

export async function shutdownPythonWorkers() {
  shuttingDown = true;
  const list = Object.values(workers);
  for (let i = 0; i < list.length; i++) {
    try { list[i].kill(); } catch {}
  }
}

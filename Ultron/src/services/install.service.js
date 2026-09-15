import path from "node:path";
import fs from "node:fs/promises";
import { spawnSync } from "node:child_process";
import { paths } from "../config/paths.js";
import { config } from "../config/index.js";
import { MODEL_REGISTRY } from "../config/models.js";
import { ensureDir, fileExists } from "../utils/fs.js";
import { downloadFile } from "./download.service.js";

function pythonCommand() {
  if (process.platform === "win32") return ["py", ["-3"]];
  return ["python3", []];
}

function run(command, args, label) {
  console.log(`[INSTALL] ${label}`);
  const result = spawnSync(command, args, { stdio: "inherit", cwd: paths.root, windowsHide: true });
  if (result.status !== 0) throw new Error(`${label} failed with exit code ${result.status}`);
}

async function ensurePython() {
  const [python, prefix] = pythonCommand();
  if (!(await fileExists(config.pythonVenvPython))) {
    await ensureDir(path.dirname(config.pythonVenvPython));
    run(python, [...prefix, "-m", "venv", ".venv"], "Creating Python virtual environment");
  }
  run(config.pythonVenvPython, ["-m", "pip", "install", "--upgrade", "pip"], "Updating pip");
  run(config.pythonVenvPython, ["-m", "pip", "install", "-r", "requirements.txt"], "Installing Python speech dependencies");
}

async function downloadVosk(model) {
  const zipPath = path.join(paths.temp, model.archiveName);
  const finalPath = path.join(paths.vosk, model.folder);
  if (await fileExists(path.join(finalPath, "conf", "model.conf"))) return;
  await downloadFile(model.url, zipPath, `vosk-${model.id}`, model.name);
  run(config.pythonVenvPython, ["-c", [
    "import zipfile,sys,os,shutil",
    "z=zipfile.ZipFile(sys.argv[1])",
    "out=sys.argv[2]",
    "names=z.namelist()",
    "root=names[0].split('/')[0] if names else ''",
    "z.extractall(out)",
    "src=os.path.join(out,root)",
    "target=sys.argv[3]",
    "shutil.rmtree(target,ignore_errors=True)",
    "os.makedirs(os.path.dirname(target),exist_ok=True)",
    "shutil.move(src,target)"
  ].join(";"), zipPath, paths.vosk, finalPath], `Extracting ${model.name}`);
  await fs.rm(zipPath, { force: true });
}

async function downloadPiper(model) {
  const dir = path.join(paths.piper, model.id);
  await ensureDir(dir);
  const modelPath = path.join(dir, model.modelFile);
  const configPath = path.join(dir, model.configFile);
  if (!(await fileExists(modelPath))) await downloadFile(model.url, modelPath, `piper-${model.id}-model`, `${model.name} model`);
  if (!(await fileExists(configPath))) await downloadFile(model.configUrl, configPath, `piper-${model.id}-config`, `${model.name} config`);
}

async function downloadLlm(model) {
  const modelPath = path.join(paths.llm, model.fileName);
  if (!(await fileExists(modelPath))) await downloadFile(model.url, modelPath, `llm-${model.id}`, model.name);
}

export async function installBaseline() {
  console.log("\n====================================================");
  console.log(" JARVIS MASTER INSTALL");
  console.log(" Express + Node + node-llama-cpp + Vosk + Piper");
  console.log("====================================================\n");
  await ensureDir(paths.models);
  await ensureDir(paths.llm);
  await ensureDir(paths.vosk);
  await ensureDir(paths.piper);
  await ensureDir(paths.temp);
  await ensurePython();

  console.log("[INSTALL] node-llama-cpp is installed by npm with platform-specific prebuilt bindings; no separate llama.cpp GitHub ZIP is downloaded by JARVIS.");
  console.log("[INSTALL] Downloading baseline AI models. Existing files are skipped and partial files resume.\n");

  for (let i = 0; i < MODEL_REGISTRY.vosk.length; i++) await downloadVosk(MODEL_REGISTRY.vosk[i]);
  for (let i = 0; i < MODEL_REGISTRY.piper.length; i++) await downloadPiper(MODEL_REGISTRY.piper[i]);
  const baselineLlm = MODEL_REGISTRY.llm.find(item => item.default);
  await downloadLlm(baselineLlm);

  console.log("\n[INSTALL] Baseline installation complete.");
  console.log("[INSTALL] Run: npm run dev");
}

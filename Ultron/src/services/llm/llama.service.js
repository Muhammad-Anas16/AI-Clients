import path from "node:path";
import { getLlama, LlamaChatSession } from "node-llama-cpp";
import { config } from "../../config/index.js";
import { paths } from "../../config/paths.js";
import { MODEL_REGISTRY } from "../../config/models.js";
import { fileExists } from "../../utils/fs.js";

let llama = null;
let loadedModel = null;
let loadedContext = null;
let session = null;
let activeModelId = null;
let loading = null;

export async function listModels() {
  const result = [];
  for (let i = 0; i < MODEL_REGISTRY.llm.length; i++) {
    const model = MODEL_REGISTRY.llm[i];
    result.push({ ...model, installed: await fileExists(path.join(paths.llm, model.fileName)) });
  }
  return result;
}

async function findInstalled(modelId) {
  const model = MODEL_REGISTRY.llm.find(item => item.id === modelId);
  if (!model) throw new Error("MODEL_NOT_FOUND");
  const modelPath = path.join(paths.llm, model.fileName);
  if (!(await fileExists(modelPath))) throw new Error(`MODEL_NOT_DOWNLOADED: ${model.id}`);
  return { model, modelPath };
}

export async function load(modelId = config.llmModel) {
  if (activeModelId === modelId && loadedModel && session) return;
  if (loading) return loading;

  loading = (async () => {
    const selected = await findInstalled(modelId);
    await unload();
    if (!llama) llama = await getLlama();
    loadedModel = await llama.loadModel({ modelPath: selected.modelPath });
    loadedContext = await loadedModel.createContext({ contextSize: config.llamaContext, threads: config.llamaThreads });
    session = new LlamaChatSession({ contextSequence: loadedContext.getSequence() });
    activeModelId = modelId;
    console.log(`[LLAMA] ready: ${selected.model.name}`);
  })();

  try {
    await loading;
  } finally {
    loading = null;
  }
}

export async function unload() {
  session = null;
  if (loadedContext && typeof loadedContext.dispose === "function") await loadedContext.dispose();
  loadedContext = null;
  if (loadedModel && typeof loadedModel.dispose === "function") await loadedModel.dispose();
  loadedModel = null;
  activeModelId = null;
}

export function status() {
  return {
    ready: Boolean(session),
    activeModel: activeModelId,
    runtime: "node-llama-cpp"
  };
}

export async function chat(message, options = {}) {
  if (typeof message !== "string" || !message.trim()) throw new Error("INVALID_MESSAGE");
  await load(options.modelId || config.llmModel);
  const maxTokens = Math.min(Number(options.maxTokens || config.llamaMaxTokens), 128);
  const prompt = message.trim().slice(0, 4000);
  const answer = await session.prompt(prompt, {
    maxTokens,
    temperature: Number(options.temperature ?? 0.2),
    topP: Number(options.topP ?? 0.8)
  });
  return String(answer).trim();
}

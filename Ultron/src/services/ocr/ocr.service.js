import { createWorker } from "tesseract.js";

let worker = null;
let loading = null;

async function getWorker(language = "eng") {
  if (worker) return worker;
  if (loading) return loading;
  loading = (async () => {
    worker = await createWorker(language);
    return worker;
  })();
  try { return await loading; } finally { loading = null; }
}

export function status() {
  return { ready: Boolean(worker), runtime: "tesseract.js", lazy: true };
}

export async function recognize(imageBuffer, language = "eng") {
  if (!imageBuffer || imageBuffer.length === 0) throw new Error("INVALID_IMAGE");
  const activeWorker = await getWorker(language);
  const result = await activeWorker.recognize(imageBuffer);
  return { text: String(result.data?.text || "").trim() };
}

export async function shutdown() {
  if (worker) await worker.terminate();
  worker = null;
}

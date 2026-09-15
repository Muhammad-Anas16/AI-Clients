import express from "express";
import multer from "multer";
import fs from "node:fs/promises";
import * as llama from "../services/llm/llama.service.js";
import * as speech from "../services/speech/speech.service.js";
import * as ocr from "../services/ocr/ocr.service.js";
import * as modelService from "../services/model.service.js";
import { MODEL_REGISTRY } from "../config/models.js";
import { getDownloads, subscribe } from "../services/download.service.js";
import { config } from "../config/index.js";
import { paths } from "../config/paths.js";

const upload = multer({ dest: paths.temp, limits: { fileSize: config.maxUploadBytes } });
const router = express.Router();

router.get("/models", async (_req, res, next) => { try { res.json(await modelService.list()); } catch (e) { next(e); } });
router.get("/models/:type", async (req, res, next) => { try { const all = await modelService.list(); res.json(all[req.params.type] || []); } catch (e) { next(e); } });
router.get("/models/active", async (_req, res, next) => { try { res.json(await modelService.active()); } catch (e) { next(e); } });
router.get("/downloads", (_req, res) => res.json(getDownloads()));
router.get("/downloads/events", (req, res) => {
  res.writeHead(200, { "Content-Type": "text/event-stream", "Cache-Control": "no-cache", Connection: "keep-alive" });
  const send = value => res.write(`data: ${JSON.stringify(value)}\n\n`);
  const off = subscribe(send);
  req.on("close", off);
});
router.get("/status", async (_req, res, next) => { try { const { status } = await import("../services/status.service.js"); res.json(await status()); } catch (e) { next(e); } });
router.get("/health", (_req, res) => res.json({ ok: true, service: "jarvis-master-server" }));

router.post("/ai/chat", async (req, res, next) => { try { res.json({ text: await llama.chat(req.body?.message, req.body) }); } catch (e) { next(e); } });
router.get("/ai/models", async (_req, res, next) => { try { res.json({ models: await llama.listModels() }); } catch (e) { next(e); } });
router.post("/ai/load", async (req, res, next) => { try { await llama.load(req.body?.modelId); res.json(llama.status()); } catch (e) { next(e); } });
router.post("/ai/unload", async (_req, res, next) => { try { await llama.unload(); res.json({ ok: true }); } catch (e) { next(e); } });

router.post("/speech/transcribe", express.json({ limit: config.maxUploadBytes }), async (req, res, next) => { try { res.json(await speech.transcribe(req.body?.audioBase64, req.body?.language || "en-us")); } catch (e) { next(e); } });
router.post("/speech/speak", async (req, res, next) => { try { const result = await speech.speak(req.body?.text, req.body?.language || "en-us"); res.json(result); } catch (e) { next(e); } });
router.get("/speech/status", (_req, res) => res.json(speech.status()));

router.post("/ocr", upload.single("image"), async (req, res, next) => {
  if (!req.file) return next(new Error("INVALID_IMAGE"));
  try { const data = await fs.readFile(req.file.path); const result = await ocr.recognize(data, req.body?.language || "eng"); res.json(result); }
  catch (e) { next(e); }
  finally { await fs.rm(req.file.path, { force: true }); }
});
router.get("/ocr/status", (_req, res) => res.json(ocr.status()));

router.get("/wasm/status", (_req, res) => res.json({ ok: true, note: "Server-side voice uses Vosk. Browser WASM is not part of the core pipeline." }));

export default router;

export const modelRegistry = MODEL_REGISTRY;

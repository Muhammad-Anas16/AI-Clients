import fs from "node:fs";
import fsPromises from "node:fs/promises";
import { EventEmitter } from "node:events";

const emitter = new EventEmitter();
const active = new Map();
const lastPrinted = new Map();

export function getDownloads() { return Array.from(active.values()); }
export function subscribe(listener) { emitter.on("progress", listener); return () => emitter.off("progress", listener); }

function printProgress(progress) {
  if (progress.status === "complete" || progress.status === "failed" || progress.status === "retrying") {
    process.stdout.write(`\n[DOWNLOAD] ${progress.label} ${progress.status}${progress.error ? `: ${progress.error}` : ""}\n`);
    return;
  }
  const now = Date.now();
  const previous = lastPrinted.get(progress.id) || 0;
  if (now - previous < 400) return;
  lastPrinted.set(progress.id, now);
  const downloadedMB = (progress.downloaded / 1024 / 1024).toFixed(1);
  const totalMB = progress.total ? (progress.total / 1024 / 1024).toFixed(1) : "?";
  process.stdout.write(`\r[DOWNLOAD] ${progress.label} ${progress.percent}% ${downloadedMB} MB / ${totalMB} MB ${progress.speedMBps || 0} MB/s`);
}

function emit(progress) {
  active.set(progress.id, progress);
  printProgress(progress);
  emitter.emit("progress", progress);
}

function wait(ms) { return new Promise(resolve => setTimeout(resolve, ms)); }

async function fetchWithRetry(url, options, label) {
  let lastError = null;
  for (let attempt = 1; attempt <= 4; attempt++) {
    try {
      const response = await fetch(url, options);
      if (response.ok && response.body) return response;
      if (response.status === 429 || response.status >= 500) throw new Error(`HTTP_${response.status}`);
      throw new Error(`DOWNLOAD_HTTP_${response.status}`);
    } catch (error) {
      lastError = error;
      const delay = 1000 * attempt;
      emit({ id: `${label}:retry`, label, status: "retrying", attempt, nextRetryMs: delay, error: error.message });
      await wait(delay);
    }
  }
  throw new Error(`DOWNLOAD_FAILED: ${label}: ${lastError?.message || "network request failed"}; URL=${url}`);
}

export async function downloadFile(url, destination, id, label) {
  const temp = `${destination}.part`;
  let existing = 0;
  try { existing = (await fsPromises.stat(temp)).size; } catch {}

  const headers = existing > 0 ? { Range: `bytes=${existing}-` } : {};
  const response = await fetchWithRetry(url, { redirect: "follow", headers }, label);
  let append = false;
  let downloaded = existing;
  let total = Number(response.headers.get("content-length") || 0);
  const contentRange = response.headers.get("content-range");

  if (existing > 0 && response.status === 206 && contentRange) {
    append = true;
    const slash = contentRange.lastIndexOf("/");
    if (slash >= 0) total = Number(contentRange.slice(slash + 1)) || existing + total;
  } else {
    downloaded = 0;
    existing = 0;
  }

  const slashIndex = Math.max(destination.lastIndexOf("/"), destination.lastIndexOf("\\"));
  if (slashIndex > 0) await fsPromises.mkdir(destination.slice(0, slashIndex), { recursive: true });

  const file = fs.createWriteStream(temp, { flags: append ? "a" : "w" });
  const reader = response.body.getReader();
  const started = Date.now();
  emit({ id, label, status: "downloading", downloaded, total, percent: total ? Number(((downloaded / total) * 100).toFixed(1)) : 0, speedMBps: 0 });

  try {
    for (;;) {
      const chunk = await reader.read();
      if (chunk.done) break;
      downloaded += chunk.value.length;
      file.write(Buffer.from(chunk.value));
      const seconds = Math.max(0.001, (Date.now() - started) / 1000);
      const percent = total ? Number(((downloaded / total) * 100).toFixed(1)) : 0;
      emit({ id, label, status: "downloading", downloaded, total, percent, speedMBps: Number(((downloaded - existing) / 1024 / 1024 / seconds).toFixed(2)) });
    }
    await new Promise((resolve, reject) => file.end(error => error ? reject(error) : resolve()));
  } catch (error) {
    file.destroy();
    emit({ id, label, status: "failed", downloaded, total, percent: total ? Number(((downloaded / total) * 100).toFixed(1)) : 0, error: error.message });
    throw error;
  }

  const finalSize = (await fsPromises.stat(temp)).size;
  await fsPromises.rename(temp, destination);
  emit({ id, label, status: "complete", downloaded: finalSize, total: finalSize, percent: 100, speedMBps: 0 });
}

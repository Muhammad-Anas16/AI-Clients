import fs from "node:fs/promises";

export async function ensureDir(directory) {
  await fs.mkdir(directory, { recursive: true });
}

export async function fileExists(filePath) {
  try {
    await fs.access(filePath);
    return true;
  } catch {
    return false;
  }
}

export async function removeFile(filePath) {
  await fs.rm(filePath, { force: true });
}

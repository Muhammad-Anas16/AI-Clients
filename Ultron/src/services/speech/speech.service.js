import * as python from "./python-client.js";

export function status() {
  return { provider: "python-websocket", languages: ["en-us", "hi-in"] };
}

export async function transcribe(audioBase64, language = "en-us") {
  if (!audioBase64) throw new Error("INVALID_AUDIO");
  return python.transcribe(audioBase64, language);
}

export async function speak(text, language = "en-us") {
  if (!String(text || "").trim()) throw new Error("INVALID_TEXT");
  return python.speak(String(text).slice(0, 4000), language);
}

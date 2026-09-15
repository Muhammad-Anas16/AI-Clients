import argparse
import asyncio
import base64
import io
import json
import os
import threading
import wave

import websockets
from piper import PiperVoice

ROOT = os.path.abspath(os.path.join(os.path.dirname(__file__), "..", ".."))
VOICES = {
    "en-us": os.path.join(ROOT, "models", "piper", "en-us-lessac-low", "en_US-lessac-low.onnx"),
    "hi-in": os.path.join(ROOT, "models", "piper", "hi-in-pratham-medium", "hi_IN-pratham-medium.onnx"),
}
cache = {}
lock = threading.Lock()

def load_voice(language):
    if language not in VOICES:
        raise ValueError("UNSUPPORTED_LANGUAGE")
    path = VOICES[language]
    if not os.path.isfile(path):
        raise FileNotFoundError("MODEL_NOT_DOWNLOADED")
    with lock:
        if language not in cache:
            cache[language] = PiperVoice.load(path)
        return cache[language]

def synthesize(voice, text):
    output = io.BytesIO()
    with wave.open(output, "wb") as wav:
        voice.synthesize(text, wav)
    return output.getvalue()

async def handler(websocket):
    async for raw in websocket:
        try:
            request = json.loads(raw)
            if request.get("action") != "speak":
                raise ValueError("UNKNOWN_ACTION")
            text = str(request.get("text", "")).strip()
            if not text:
                raise ValueError("INVALID_TEXT")
            audio = synthesize(load_voice(request.get("language", "en-us")), text[:4000])
            await websocket.send(json.dumps({"type": "result", "audioBase64": base64.b64encode(audio).decode("ascii"), "mime": "audio/wav"}))
        except Exception as exc:
            await websocket.send(json.dumps({"type": "error", "code": "TTS_FAILED", "message": str(exc)}))

async def main(host, port):
    print(f"Piper service listening on ws://{host}:{port}", flush=True)
    async with websockets.serve(handler, host, port, max_size=10 * 1024 * 1024):
        await asyncio.Event().wait()

if __name__ == "__main__":
    parser = argparse.ArgumentParser()
    parser.add_argument("--host", default="127.0.0.1")
    parser.add_argument("--port", type=int, default=8766)
    args = parser.parse_args()
    asyncio.run(main(args.host, args.port))

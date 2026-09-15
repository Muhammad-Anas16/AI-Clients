import argparse
import asyncio
import base64
import io
import json
import os
import threading
import wave

import websockets
from vosk import Model, KaldiRecognizer

ROOT = os.path.abspath(os.path.join(os.path.dirname(__file__), "..", ".."))
MODELS = {
    "en-us": os.path.join(ROOT, "models", "vosk", "vosk-model-small-en-us-0.15"),
    "hi-in": os.path.join(ROOT, "models", "vosk", "vosk-model-small-hi-0.22"),
}
cache = {}
lock = threading.Lock()

def load_model(language):
    if language not in MODELS:
        raise ValueError("UNSUPPORTED_LANGUAGE")
    path = MODELS[language]
    if not os.path.isdir(path):
        raise FileNotFoundError("MODEL_NOT_DOWNLOADED")
    with lock:
        if language not in cache:
            cache[language] = Model(path)
        return cache[language]

def decode_wav(data):
    with wave.open(io.BytesIO(data), "rb") as wav:
        if wav.getnchannels() != 1 or wav.getsampwidth() != 2:
            raise ValueError("INVALID_AUDIO_FORMAT: mono 16-bit PCM WAV required")
        return wav.getframerate(), wav.readframes(wav.getnframes())

async def handler(websocket):
    async for raw in websocket:
        try:
            request = json.loads(raw)
            if request.get("action") != "transcribe":
                raise ValueError("UNKNOWN_ACTION")
            audio = base64.b64decode(request.get("audio", ""))
            rate, pcm = decode_wav(audio)
            recognizer = KaldiRecognizer(load_model(request.get("language", "en-us")), rate)
            for i in range(0, len(pcm), 4000):
                recognizer.AcceptWaveform(pcm[i:i + 4000])
            result = json.loads(recognizer.FinalResult())
            await websocket.send(json.dumps({"type": "result", "text": result.get("text", "").strip()}))
        except Exception as exc:
            await websocket.send(json.dumps({"type": "error", "code": "STT_FAILED", "message": str(exc)}))

async def main(host, port):
    print(f"Vosk service listening on ws://{host}:{port}", flush=True)
    async with websockets.serve(handler, host, port, max_size=25 * 1024 * 1024):
        await asyncio.Event().wait()

if __name__ == "__main__":
    parser = argparse.ArgumentParser()
    parser.add_argument("--host", default="127.0.0.1")
    parser.add_argument("--port", type=int, default=8765)
    args = parser.parse_args()
    asyncio.run(main(args.host, args.port))

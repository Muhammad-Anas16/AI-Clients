# JARVIS Master Server 10.0.1

Small JavaScript-first AI assistant backend for low-RAM PCs and a future Tauri/Android client.

## What runs where

```text
Client (PC / Tauri / Android)
          |
          | HTTP + WebSocket
          v
Node.js + Express
  |-- node-llama-cpp -> LLaMA/Qwen
  |-- Tesseract.js   -> OCR
  |-- WebSocket -> Python Vosk worker
  |-- WebSocket -> Python Piper worker
  `-- WebSocket -> full assistant pipeline
```

There is no separate `llama-server.exe` and no GitHub llama.cpp ZIP download in the installer. `node-llama-cpp` is an npm dependency with pre-built Windows, Linux and macOS bindings; the application imports it directly. citeturn913175search0turn913175search4

Vosk and Piper are local Python workers. Vosk expects mono 16-bit PCM WAV input for this simple HTTP/WebSocket adapter. citeturn180870search2 Piper is loaded with `PiperVoice.load()` and synthesized with its Python API. citeturn180870search0

## Install

Requirements:

- Node.js 20+
- Python 3.9+
- Windows x64, Linux x64 or macOS

Run only:

```powershell
npm i
npm run dev
```

`npm i` installs Node dependencies, creates `.venv`, installs Python dependencies, downloads Vosk English/Hindi, downloads Piper English/Hindi, then downloads the smallest default Qwen model. Completed files are skipped. Interrupted large files use `.part` files and resume when the server can receive a range response.

The install script prints real download progress in the terminal.

## Default models

- Vosk Small English US
- Vosk Small Hindi
- Piper English US Lessac Low
- Piper Hindi Pratham Medium
- Qwen2.5 0.5B Instruct Q2_K

Qwen Q2_K is the smallest file in the selected Qwen2.5-0.5B GGUF repository. citeturn239607search14

The Piper English Lessac Low voice is about 63.2 MB and the Hindi Pratham Medium voice is about 63.5 MB. citeturn239607search0turn239607search2

## API

- `GET /health`
- `GET /api/status`
- `GET /api/models`
- `GET /api/downloads`
- `GET /api/downloads/events` (SSE)
- `POST /api/ai/chat`
- `POST /api/speech/transcribe`
- `POST /api/speech/speak`
- `POST /api/ocr`

## WebSocket

```text
ws://127.0.0.1:3000/ws/jarvis
```

Messages:

```json
{"type":"chat","message":"Hello"}
{"type":"transcribe","audioBase64":"...","language":"en-us"}
{"type":"speak","text":"Hello","language":"en-us"}
{"type":"ocr","imageBase64":"...","language":"eng"}
{"type":"pipeline","audioBase64":"...","language":"en-us"}
```

The pipeline returns events in this order:

```text
pipeline.state = listen
pipeline.transcript
pipeline.state = think
pipeline.think
pipeline.state = speak
pipeline.audio
pipeline.done
```

## Low RAM

LLaMA is lazy-loaded and only one model is active. Vosk and Piper also load only the selected language when first used. Tesseract is lazy-loaded. Context size and generation token limits are intentionally small.

## Troubleshooting

If `npm i` stops at a download, run it again. The installer resumes `.part` downloads when the remote server supports HTTP Range.

If a download endpoint returns an HTTP error, the installer prints the exact model label and URL instead of reporting a vague llama.cpp runtime error.

If `node-llama-cpp` reports a platform/build problem during `npm i`, do not download a random llama.cpp ZIP. The npm package provides platform-specific prebuilt bindings and documents a source-build fallback when a binding is unavailable. citeturn913175search0

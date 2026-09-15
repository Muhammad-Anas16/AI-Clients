const hf = "https://huggingface.co";

export const MODEL_REGISTRY = {
  llm: [
    {
      id: "qwen25-0.5b-q2",
      name: "Qwen2.5 0.5B Instruct Q2_K",
      fileName: "Qwen2.5-0.5B-Instruct-Q2_K.gguf",
      sizeMB: 350,
      default: true,
      language: "Multilingual",
      url: `${hf}/tensorblock/Qwen2.5-0.5B-Instruct-GGUF/resolve/main/Qwen2.5-0.5B-Instruct-Q2_K.gguf?download=true`,
      description: "Smallest practical Qwen2.5 GGUF; intended for low-RAM CPU systems."
    },
    {
      id: "qwen25-0.5b-q4",
      name: "Qwen2.5 0.5B Instruct Q4_K_M",
      fileName: "Qwen2.5-0.5B-Instruct-Q4_K_M.gguf",
      sizeMB: 410,
      default: false,
      language: "Multilingual",
      url: `${hf}/tensorblock/Qwen2.5-0.5B-Instruct-GGUF/resolve/main/Qwen2.5-0.5B-Instruct-Q4_K_M.gguf?download=true`,
      description: "Higher-quality optional quantization; still small enough for modest machines."
    }
  ],
  vosk: [
    {
      id: "en-us-small",
      name: "Vosk Small English US",
      folder: "vosk-model-small-en-us-0.15",
      archiveName: "vosk-model-small-en-us-0.15.zip",
      sizeMB: 40,
      language: "en-US",
      default: true,
      url: "https://alphacephei.com/vosk/models/vosk-model-small-en-us-0.15.zip",
      description: "Lightweight English model suitable for low-RAM machines."
    },
    {
      id: "hi-small",
      name: "Vosk Small Hindi",
      folder: "vosk-model-small-hi-0.22",
      archiveName: "vosk-model-small-hi-0.22.zip",
      sizeMB: 42,
      language: "hi-IN",
      default: false,
      url: "https://alphacephei.com/vosk/models/vosk-model-small-hi-0.22.zip",
      description: "Lightweight Hindi model for mobile-class and desktop-class systems."
    }
  ],
  piper: [
    {
      id: "en-us-lessac-low",
      name: "Piper English US Lessac Low",
      language: "en-US",
      modelFile: "en_US-lessac-low.onnx",
      configFile: "en_US-lessac-low.onnx.json",
      sizeMB: 64,
      default: true,
      url: `${hf}/rhasspy/piper-voices/resolve/main/en/en_US/lessac/low/en_US-lessac-low.onnx?download=true`,
      configUrl: `${hf}/rhasspy/piper-voices/resolve/main/en/en_US/lessac/low/en_US-lessac-low.onnx.json?download=true`,
      description: "Low-quality/low-size English Piper voice for fast low-RAM TTS."
    },
    {
      id: "hi-in-pratham-medium",
      name: "Piper Hindi Pratham Medium",
      language: "hi-IN",
      modelFile: "hi_IN-pratham-medium.onnx",
      configFile: "hi_IN-pratham-medium.onnx.json",
      sizeMB: 64,
      default: false,
      url: `${hf}/rhasspy/piper-voices/resolve/main/hi/hi_IN/pratham/medium/hi_IN-pratham-medium.onnx?download=true`,
      configUrl: `${hf}/rhasspy/piper-voices/resolve/main/hi/hi_IN/pratham/medium/hi_IN-pratham-medium.onnx.json?download=true`,
      description: "Real Hindi Piper voice; medium quality but still practical for low-RAM TTS."
    }
  ]
};

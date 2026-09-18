import { useEffect, useRef, useState } from "react";
import { transcribeAudio } from "../../services/api";

// ============================================================
// VOSK ENDPOINT - sirf UI/debug information ke liye
// Actual request transcribeAudio() service ke through ja rahi hai
// ============================================================

const VOSK_ENDPOINT = "http://192.168.1.57:3000/api/vosk/transcribe";

// ============================================================
// FLOAT32 -> 16 BIT PCM
// ============================================================

function floatTo16BitPCM(float32Array) {
  const buffer = new ArrayBuffer(float32Array.length * 2);
  const view = new DataView(buffer);

  for (let i = 0; i < float32Array.length; i += 1) {
    const sample = Math.max(-1, Math.min(1, float32Array[i]));

    const value = sample < 0 ? sample * 0x8000 : sample * 0x7fff;

    view.setInt16(i * 2, value, true);
  }

  return new Uint8Array(buffer);
}

// ============================================================
// RESAMPLE -> 16kHz
// Works for both downsampling and upsampling
// ============================================================

function resampleTo16k(float32Array, inputSampleRate) {
  const targetSampleRate = 16000;

  // Already 16kHz
  if (inputSampleRate === targetSampleRate) {
    return float32Array;
  }

  const outputLength = Math.max(
    1,
    Math.round(
      float32Array.length * (targetSampleRate / inputSampleRate),
    ),
  );

  const result = new Float32Array(outputLength);

  const ratio = inputSampleRate / targetSampleRate;

  for (let i = 0; i < outputLength; i += 1) {
    const position = i * ratio;

    const index = Math.floor(position);

    const nextIndex = Math.min(index + 1, float32Array.length - 1);

    const fraction = position - index;

    const current = float32Array[index] || 0;

    const next = float32Array[nextIndex] || 0;

    // Linear interpolation
    result[i] = current + (next - current) * fraction;
  }

  return result;
}

// ============================================================
// CREATE WAV
// ============================================================

function encodeWav(float32Array, sampleRate = 16000) {
  const pcmData = floatTo16BitPCM(float32Array);

  const wavBuffer = new ArrayBuffer(44 + pcmData.length);

  const view = new DataView(wavBuffer);

  const writeString = (offset, value) => {
    for (let i = 0; i < value.length; i += 1) {
      view.setUint8(offset + i, value.charCodeAt(i));
    }
  };

  // RIFF
  writeString(0, "RIFF");

  view.setUint32(4, 36 + pcmData.length, true);

  // WAVE
  writeString(8, "WAVE");

  // fmt
  writeString(12, "fmt ");

  view.setUint32(16, 16, true);

  // PCM format
  view.setUint16(20, 1, true);

  // Mono
  view.setUint16(22, 1, true);

  // Sample rate
  view.setUint32(24, sampleRate, true);

  // Byte rate
  view.setUint32(28, sampleRate * 2, true);

  // Block align
  view.setUint16(32, 2, true);

  // Bits per sample
  view.setUint16(34, 16, true);

  // data
  writeString(36, "data");

  view.setUint32(40, pcmData.length, true);

  new Uint8Array(wavBuffer, 44).set(pcmData);

  return new Blob([wavBuffer], {
    type: "audio/wav",
  });
}

// ============================================================
// GET TRANSCRIPT FROM SERVER RESPONSE
// ============================================================

function getTranscript(response) {
  if (!response) {
    return "";
  }

  if (typeof response === "string") {
    return response.trim();
  }

  const values = [
    response.text,
    response.transcript,

    response.result?.text,

    response.data?.text,
    response.data?.transcript,

    response.data?.result?.text,

    response.data?.data?.text,
    response.data?.data?.transcript,
  ];

  for (const value of values) {
    if (typeof value === "string" && value.trim()) {
      return value.trim();
    }
  }

  return "";
}

// ============================================================
// FILE AUDIO -> MONO FLOAT32
//
// Uploaded file:
// MP3 / WAV / M4A / WEBM etc.
//        ↓
// Browser decode
//        ↓
// Mono Float32
// ============================================================

async function decodeAudioFileToMono(file) {
  const AudioContext =
    window.AudioContext || window.webkitAudioContext;

  if (!AudioContext) {
    throw new Error("Web Audio API is not supported.");
  }

  const arrayBuffer = await file.arrayBuffer();

  const audioContext = new AudioContext();

  try {
    const audioBuffer = await audioContext.decodeAudioData(
      arrayBuffer,
    );

    const channelCount = audioBuffer.numberOfChannels;

    const totalSamples = audioBuffer.length;

    // Mono output
    const mono = new Float32Array(totalSamples);

    // --------------------------------------------------------
    // Convert multiple channels -> mono
    // --------------------------------------------------------

    if (channelCount === 1) {
      const channel = audioBuffer.getChannelData(0);

      mono.set(channel);
    } else {
      for (let channelIndex = 0; channelIndex < channelCount; channelIndex += 1) {
        const channelData = audioBuffer.getChannelData(channelIndex);

        for (let i = 0; i < totalSamples; i += 1) {
          mono[i] += channelData[i] / channelCount;
        }
      }
    }

    return {
      samples: mono,
      sampleRate: audioBuffer.sampleRate,
      duration: audioBuffer.duration,
    };
  } finally {
    if (audioContext.state !== "closed") {
      await audioContext.close();
    }
  }
}

// ============================================================
// COMPONENT
// ============================================================

export default function VoskRecorder() {
  // ==========================================================
  // UI STATE
  // ==========================================================

  const [recording, setRecording] = useState(false);

  const [processing, setProcessing] = useState(false);

  const [status, setStatus] = useState("Ready");

  const [transcript, setTranscript] = useState("");

  const [error, setError] = useState("");

  // Selected recorded audio file
  const [selectedFile, setSelectedFile] = useState(null);

  // ==========================================================
  // MICROPHONE REFERENCES
  // ==========================================================

  const rawStreamRef = useRef(null);

  // ==========================================================
  // AUDIO CONTEXT
  // ==========================================================

  const audioContextRef = useRef(null);

  // ==========================================================
  // MICROPHONE SOURCE
  // ==========================================================

  const sourceRef = useRef(null);

  // ==========================================================
  // PROCESSOR
  // ==========================================================

  const processorRef = useRef(null);

  // ==========================================================
  // MUTE OUTPUT
  // ==========================================================

  const muteGainRef = useRef(null);

  // ==========================================================
  // RECORDED AUDIO CHUNKS
  // ==========================================================

  const chunksRef = useRef([]);

  // ==========================================================
  // ACTUAL BROWSER SAMPLE RATE
  // ==========================================================

  const sampleRateRef = useRef(48000);

  // ==========================================================
  // INTERNAL RECORDING STATE
  // ==========================================================

  const recordingRef = useRef(false);

  // ==========================================================
  // FILE INPUT REF
  // ==========================================================

  const fileInputRef = useRef(null);

  // ==========================================================
  // CLEANUP
  // ==========================================================

  const cleanup = async () => {
    recordingRef.current = false;

    // --------------------------------------------------------
    // PROCESSOR
    // --------------------------------------------------------

    if (processorRef.current) {
      processorRef.current.onaudioprocess = null;

      processorRef.current.disconnect();

      processorRef.current = null;
    }

    // --------------------------------------------------------
    // SOURCE
    // --------------------------------------------------------

    if (sourceRef.current) {
      sourceRef.current.disconnect();

      sourceRef.current = null;
    }

    // --------------------------------------------------------
    // MUTE GAIN
    // --------------------------------------------------------

    if (muteGainRef.current) {
      muteGainRef.current.disconnect();

      muteGainRef.current = null;
    }

    // --------------------------------------------------------
    // MICROPHONE STREAM
    // --------------------------------------------------------

    if (rawStreamRef.current) {
      rawStreamRef.current.getTracks().forEach((track) => {
        track.stop();
      });

      rawStreamRef.current = null;
    }

    // --------------------------------------------------------
    // AUDIO CONTEXT
    // --------------------------------------------------------

    if (audioContextRef.current) {
      const context = audioContextRef.current;

      audioContextRef.current = null;

      if (context.state !== "closed") {
        await context.close();
      }
    }
  };

  // ==========================================================
  // CLEANUP WHEN COMPONENT UNMOUNTS
  // ==========================================================

  useEffect(() => {
    return () => {
      cleanup().catch((error) => {
        console.error("Audio cleanup error:", error);
      });
    };
  }, []);

  // ==========================================================
  // START MICROPHONE RECORDING
  //
  // FLOW:
  //
  // Microphone
  //    ↓
  // High Pass
  //    ↓
  // 50Hz Notch
  //    ↓
  // 100Hz Notch
  //    ↓
  // Low Pass
  //    ↓
  // Compressor
  //    ↓
  // Float32 chunks
  // ==========================================================

  const startRecording = async () => {
    try {
      // Reset UI
      setError("");

      setTranscript("");

      setSelectedFile(null);

      setStatus("Requesting microphone...");

      // ------------------------------------------------------
      // CHECK SECURE CONTEXT
      // ------------------------------------------------------

      if (!window.isSecureContext) {
        throw new Error(
          "Microphone requires HTTPS or localhost.",
        );
      }

      // ------------------------------------------------------
      // CHECK MICROPHONE API
      // ------------------------------------------------------

      if (!navigator.mediaDevices?.getUserMedia) {
        throw new Error(
          "Microphone API is not available.",
        );
      }

      // ------------------------------------------------------
      // REQUEST MICROPHONE
      // ------------------------------------------------------

      const rawStream =
        await navigator.mediaDevices.getUserMedia({
          audio: {
            channelCount: 1,

            echoCancellation: true,

            noiseSuppression: true,

            autoGainControl: true,

            sampleRate: 16000,

            sampleSize: 16,
          },

          video: false,
        });

      rawStreamRef.current = rawStream;

      // ------------------------------------------------------
      // AUDIO CONTEXT
      // ------------------------------------------------------

      const AudioContext =
        window.AudioContext || window.webkitAudioContext;

      if (!AudioContext) {
        throw new Error(
          "Web Audio API is not supported.",
        );
      }

      const audioContext = new AudioContext();

      audioContextRef.current = audioContext;

      sampleRateRef.current = audioContext.sampleRate;

      if (audioContext.state === "suspended") {
        await audioContext.resume();
      }

      // ------------------------------------------------------
      // MICROPHONE SOURCE
      // ------------------------------------------------------

      const source =
        audioContext.createMediaStreamSource(
          rawStream,
        );

      sourceRef.current = source;

      // ------------------------------------------------------
      // HIGH PASS
      // Removes low frequency rumble
      // ------------------------------------------------------

      const highPass =
        audioContext.createBiquadFilter();

      highPass.type = "highpass";

      highPass.frequency.value = 80;

      highPass.Q.value = 0.7;

      // ------------------------------------------------------
      // 50Hz NOTCH
      // Removes electrical hum
      // ------------------------------------------------------

      const notch50 =
        audioContext.createBiquadFilter();

      notch50.type = "notch";

      notch50.frequency.value = 50;

      notch50.Q.value = 10;

      // ------------------------------------------------------
      // 100Hz NOTCH
      // Removes harmonic hum
      // ------------------------------------------------------

      const notch100 =
        audioContext.createBiquadFilter();

      notch100.type = "notch";

      notch100.frequency.value = 100;

      notch100.Q.value = 10;

      // ------------------------------------------------------
      // LOW PASS
      // Keeps useful speech range
      // ------------------------------------------------------

      const lowPass =
        audioContext.createBiquadFilter();

      lowPass.type = "lowpass";

      lowPass.frequency.value = 8000;

      lowPass.Q.value = 0.7;

      // ------------------------------------------------------
      // COMPRESSOR
      // Makes voice level more stable
      // ------------------------------------------------------

      const compressor =
        audioContext.createDynamicsCompressor();

      compressor.threshold.value = -24;

      compressor.knee.value = 18;

      compressor.ratio.value = 3;

      compressor.attack.value = 0.005;

      compressor.release.value = 0.15;

      // ------------------------------------------------------
      // SCRIPT PROCESSOR
      //
      // Used here to capture processed audio samples
      // ------------------------------------------------------

      const processor =
        audioContext.createScriptProcessor(
          4096,
          1,
          1,
        );

      processorRef.current = processor;

      // ------------------------------------------------------
      // MUTE OUTPUT
      //
      // Prevent microphone feedback
      // ------------------------------------------------------

      const muteGain =
        audioContext.createGain();

      muteGain.gain.value = 0;

      muteGainRef.current = muteGain;

      // ------------------------------------------------------
      // CLEAR OLD AUDIO
      // ------------------------------------------------------

      chunksRef.current = [];

      // ------------------------------------------------------
      // CAPTURE CLEAN AUDIO
      // ------------------------------------------------------

      processor.onaudioprocess = (event) => {
        if (!recordingRef.current) {
          return;
        }

        const input =
          event.inputBuffer.getChannelData(0);

        chunksRef.current.push(
          new Float32Array(input),
        );
      };

      // ------------------------------------------------------
      // AUDIO PIPELINE
      //
      // Microphone
      //     ↓
      // High Pass
      //     ↓
      // 50Hz Notch
      //     ↓
      // 100Hz Notch
      //     ↓
      // Low Pass
      //     ↓
      // Compressor
      //     ↓
      // Processor
      //     ↓
      // Mute
      //     ↓
      // Speaker (volume 0)
      // ------------------------------------------------------

      source.connect(highPass);

      highPass.connect(notch50);

      notch50.connect(notch100);

      notch100.connect(lowPass);

      lowPass.connect(compressor);

      compressor.connect(processor);

      processor.connect(muteGain);

      muteGain.connect(
        audioContext.destination,
      );

      // ------------------------------------------------------
      // START
      // ------------------------------------------------------

      recordingRef.current = true;

      setRecording(true);

      setStatus(
        "Recording clean audio... Speak now.",
      );
    } catch (error) {
      console.error(
        "Microphone error:",
        error,
      );

      await cleanup();

      setRecording(false);

      setStatus("Failed");

      setError(
        error?.message ||
          "Could not start microphone.",
      );
    }
  };

  // ==========================================================
  // STOP MICROPHONE + SEND TO VOSK
  //
  // FLOW:
  //
  // Float32 chunks
  //       ↓
  // Combine
  //       ↓
  // Resample 16kHz
  //       ↓
  // WAV
  //       ↓
  // transcribeAudio()
  //       ↓
  // Vosk Server
  //       ↓
  // Transcript
  // ==========================================================

  const stopAndTranscribe = async () => {
    if (!recordingRef.current) {
      return;
    }

    try {
      setError("");

      setRecording(false);

      setProcessing(true);

      setStatus(
        "Preparing microphone audio...",
      );

      // ------------------------------------------------------
      // STOP COLLECTING AUDIO
      // ------------------------------------------------------

      recordingRef.current = false;

      const chunks = chunksRef.current;

      if (!chunks.length) {
        throw new Error(
          "No audio was captured.",
        );
      }

      // ------------------------------------------------------
      // TOTAL AUDIO LENGTH
      // ------------------------------------------------------

      let totalLength = 0;

      for (const chunk of chunks) {
        totalLength += chunk.length;
      }

      // ------------------------------------------------------
      // COMBINE CHUNKS
      // ------------------------------------------------------

      const combined =
        new Float32Array(totalLength);

      let offset = 0;

      for (const chunk of chunks) {
        combined.set(
          chunk,
          offset,
        );

        offset += chunk.length;
      }

      // ------------------------------------------------------
      // CONVERT TO 16kHz
      // ------------------------------------------------------

      const originalSampleRate =
        sampleRateRef.current;

      const mono16k = resampleTo16k(
        combined,
        originalSampleRate,
      );

      // ------------------------------------------------------
      // CREATE WAV
      // ------------------------------------------------------

      const wavBlob = encodeWav(
        mono16k,
        16000,
      );

      console.log(
        "Microphone WAV size:",
        wavBlob.size,
        "bytes",
      );

      // ------------------------------------------------------
      // CLOSE MICROPHONE
      // ------------------------------------------------------

      await cleanup();

      // ------------------------------------------------------
      // SEND TO SERVER
      // ------------------------------------------------------

      setStatus(
        "Sending microphone audio to Vosk...",
      );

      const response =
        await transcribeAudio(
          wavBlob,
        );

      console.log(
        "Vosk response:",
        response,
      );

      // ------------------------------------------------------
      // GET TRANSCRIPT
      // ------------------------------------------------------

      const text =
        getTranscript(response);

      if (!text) {
        throw new Error(
          "Vosk response received, but transcript text was not found.",
        );
      }

      setTranscript(text);

      setStatus(
        "Microphone transcription complete.",
      );
    } catch (error) {
      console.error(
        "Microphone transcription error:",
        error,
      );

      await cleanup();

      setStatus("Failed");

      setError(
        error?.response?.data?.message ||
          error?.response?.data?.error ||
          error?.message ||
          "Transcription failed.",
      );
    } finally {
      setProcessing(false);
    }
  };

  // ==========================================================
  // FILE SELECT
  //
  // User can select:
  // WAV
  // MP3
  // WEBM
  // M4A
  // OGG
  // etc.
  // ==========================================================

  const handleFileChange = (event) => {
    try {
      setError("");

      setTranscript("");

      const file =
        event.target.files?.[0];

      if (!file) {
        setSelectedFile(null);

        return;
      }

      setSelectedFile(file);

      setStatus(
        "Recorded audio selected. Ready to upload.",
      );
    } catch (error) {
      console.error(
        "File selection error:",
        error,
      );

      setError(
        error?.message ||
          "Could not select audio file.",
      );
    }
  };

  // ==========================================================
  // UPLOAD RECORDED AUDIO + SEND TO VOSK
  //
  // FLOW:
  //
  // Recorded file
  // (.mp3/.wav/.m4a/.webm...)
  //          ↓
  // Browser Audio Decoder
  //          ↓
  // Mono Float32
  //          ↓
  // 16kHz
  //          ↓
  // WAV
  //          ↓
  // Vosk Server
  //          ↓
  // Transcript
  // ==========================================================

  const uploadAndTranscribe = async () => {
    if (!selectedFile) {
      setError(
        "Please select a recorded audio file first.",
      );

      return;
    }

    try {
      setError("");

      setTranscript("");

      setProcessing(true);

      setStatus(
        "Reading recorded audio...",
      );

      console.log(
        "Selected file:",
        selectedFile.name,
      );

      console.log(
        "File type:",
        selectedFile.type,
      );

      console.log(
        "File size:",
        selectedFile.size,
        "bytes",
      );

      // ------------------------------------------------------
      // DECODE AUDIO FILE
      // ------------------------------------------------------

      const decoded =
        await decodeAudioFileToMono(
          selectedFile,
        );

      console.log(
        "Original sample rate:",
        decoded.sampleRate,
      );

      console.log(
        "Audio duration:",
        decoded.duration,
        "seconds",
      );

      // ------------------------------------------------------
      // CONVERT TO 16kHz
      // ------------------------------------------------------

      setStatus(
        "Converting recorded audio to 16kHz mono...",
      );

      const mono16k =
        resampleTo16k(
          decoded.samples,
          decoded.sampleRate,
        );

      // ------------------------------------------------------
      // CREATE STANDARD WAV
      // ------------------------------------------------------

      const wavBlob =
        encodeWav(
          mono16k,
          16000,
        );

      console.log(
        "Uploaded audio converted WAV size:",
        wavBlob.size,
        "bytes",
      );

      // ------------------------------------------------------
      // SEND TO SERVER
      // ------------------------------------------------------

      setStatus(
        "Sending recorded audio to Vosk...",
      );

      const response =
        await transcribeAudio(
          wavBlob,
        );

      console.log(
        "Vosk response:",
        response,
      );

      // ------------------------------------------------------
      // READ TRANSCRIPT
      // ------------------------------------------------------

      const text =
        getTranscript(response);

      if (!text) {
        throw new Error(
          "Vosk response received, but transcript text was not found.",
        );
      }

      setTranscript(text);

      setStatus(
        "Recorded audio transcription complete.",
      );
    } catch (error) {
      console.error(
        "Uploaded audio transcription error:",
        error,
      );

      setStatus("Failed");

      setError(
        error?.response?.data?.message ||
          error?.response?.data?.error ||
          error?.message ||
          "Could not transcribe uploaded audio.",
      );
    } finally {
      setProcessing(false);
    }
  };

  // ==========================================================
  // REMOVE SELECTED FILE
  // ==========================================================

  const clearSelectedFile = () => {
    setSelectedFile(null);

    setError("");

    setStatus("Ready");

    if (fileInputRef.current) {
      fileInputRef.current.value = "";
    }
  };

  // ==========================================================
  // CANCEL MICROPHONE
  // ==========================================================

  const cancelRecording = async () => {
    await cleanup();

    setRecording(false);

    setProcessing(false);

    setStatus("Stopped");

    setError("");
  };

  // ==========================================================
  // UI
  // ==========================================================

  return (
    <div className="min-h-screen bg-gray-100 p-6">
      <div className="mx-auto w-full max-w-3xl rounded-2xl bg-white p-6 shadow-lg">
        {/* ================================================== */}
        {/* HEADER */}
        {/* ================================================== */}

        <div>
          <h1 className="text-2xl font-bold text-gray-900">
            Voice to Vosk
          </h1>

          <p className="mt-2 text-gray-600">
            Live microphone ya recorded audio file —
            dono ko Vosk server par bhej sakte ho.
          </p>
        </div>

        {/* ================================================== */}
        {/* AUDIO FLOW */}
        {/* ================================================== */}

        <div className="mt-6 rounded-xl border border-gray-200 bg-gray-50 p-4">
          <div className="font-semibold text-gray-900">
            Audio Processing Flow
          </div>

          <div className="mt-3 text-sm leading-7 text-gray-600">
            <div>
              🎤 <strong>Microphone</strong> → Clean
              Audio → 16kHz WAV → Vosk Server
            </div>

            <div>
              📁 <strong>Recorded File</strong> → Decode
              Audio → Mono → 16kHz WAV → Vosk Server
            </div>

            <div>
              🧠 <strong>Vosk Server</strong> → Text
              Transcript → React UI
            </div>
          </div>
        </div>

        {/* ================================================== */}
        {/* SECTION 1 - LIVE MICROPHONE */}
        {/* ================================================== */}

        <div className="mt-6 rounded-2xl border border-gray-200 p-5">
          <div>
            <h2 className="text-lg font-bold text-gray-900">
              1. Live Microphone
            </h2>

            <p className="mt-1 text-sm text-gray-500">
              Direct microphone se bol kar server ko audio
              bhejo.
            </p>
          </div>

          {/* MICROPHONE BUTTONS */}

          <div className="mt-4 flex gap-3">
            {!recording ? (
              <button
                onClick={startRecording}
                disabled={processing}
                className="flex-1 rounded-xl bg-black px-5 py-3 font-medium text-white transition hover:bg-gray-800 disabled:cursor-not-allowed disabled:opacity-50"
              >
                {processing
                  ? "Processing..."
                  : "🎤 Start Microphone"}
              </button>
            ) : (
              <button
                onClick={
                  stopAndTranscribe
                }
                className="flex-1 rounded-xl bg-black px-5 py-3 font-medium text-white transition hover:bg-gray-800"
              >
                ⏹ Stop & Transcribe
              </button>
            )}

            {recording && (
              <button
                onClick={
                  cancelRecording
                }
                className="rounded-xl border border-gray-300 px-5 py-3 font-medium text-gray-800 transition hover:bg-gray-100"
              >
                Cancel
              </button>
            )}
          </div>
        </div>

        {/* ================================================== */}
        {/* SECTION 2 - RECORDED AUDIO UPLOAD */}
        {/* ================================================== */}

        <div className="mt-6 rounded-2xl border border-gray-200 p-5">
          <div>
            <h2 className="text-lg font-bold text-gray-900">
              2. Upload Recorded Voice
            </h2>

            <p className="mt-1 text-sm text-gray-500">
              Pehle se recorded voice select karo aur
              server ko bhejo.
            </p>
          </div>

          {/* FILE INPUT */}

          <div className="mt-4">
            <input
              ref={fileInputRef}
              type="file"
              accept="audio/*,.wav,.mp3,.m4a,.webm,.ogg"
              onChange={
                handleFileChange
              }
              disabled={
                processing ||
                recording
              }
              className="block w-full cursor-pointer rounded-xl border border-gray-300 bg-white p-3 text-sm text-gray-700 file:mr-4 file:rounded-lg file:border-0 file:bg-gray-100 file:px-4 file:py-2 file:font-medium hover:file:bg-gray-200 disabled:cursor-not-allowed disabled:opacity-50"
            />
          </div>

          {/* SELECTED FILE */}

          {selectedFile && (
            <div className="mt-4 rounded-xl bg-gray-50 p-4">
              <div className="text-sm font-semibold text-gray-900">
                Selected Audio
              </div>

              <div className="mt-2 break-all text-sm text-gray-600">
                {selectedFile.name}
              </div>

              <div className="mt-1 text-xs text-gray-500">
                Type:{" "}
                {selectedFile.type ||
                  "Unknown"}
              </div>

              <div className="mt-1 text-xs text-gray-500">
                Size:{" "}
                {(
                  selectedFile.size /
                  1024 /
                  1024
                ).toFixed(2)}{" "}
                MB
              </div>

              {/* FILE ACTIONS */}

              <div className="mt-4 flex gap-3">
                <button
                  onClick={
                    uploadAndTranscribe
                  }
                  disabled={
                    processing ||
                    recording ||
                    !selectedFile
                  }
                  className="flex-1 rounded-xl bg-black px-5 py-3 font-medium text-white transition hover:bg-gray-800 disabled:cursor-not-allowed disabled:opacity-50"
                >
                  {processing
                    ? "Processing..."
                    : "📤 Upload & Transcribe"}
                </button>

                <button
                  onClick={
                    clearSelectedFile
                  }
                  disabled={
                    processing
                  }
                  className="rounded-xl border border-gray-300 px-5 py-3 font-medium text-gray-800 hover:bg-gray-100 disabled:cursor-not-allowed disabled:opacity-50"
                >
                  Remove
                </button>
              </div>
            </div>
          )}
        </div>

        {/* ================================================== */}
        {/* STATUS */}
        {/* ================================================== */}

        <div className="mt-6 rounded-xl bg-gray-50 p-4">
          <div className="font-semibold text-gray-900">
            Current Status
          </div>

          <div className="mt-1 text-gray-700">
            {status}
          </div>
        </div>

        {/* ================================================== */}
        {/* TRANSCRIPT */}
        {/* ================================================== */}

        {transcript && (
          <div className="mt-6 rounded-xl border border-gray-200 p-5">
            <div className="font-semibold text-gray-900">
              Vosk Transcript
            </div>

            <p className="mt-3 text-lg leading-relaxed text-gray-700">
              {transcript}
            </p>
          </div>
        )}

        {/* ================================================== */}
        {/* ERROR */}
        {/* ================================================== */}

        {error && (
          <div className="mt-6 rounded-xl bg-red-50 p-4 text-red-700">
            <div className="font-semibold">
              Error
            </div>

            <div className="mt-1">
              {error}
            </div>
          </div>
        )}

        {/* ================================================== */}
        {/* DEBUG INFORMATION */}
        {/* ================================================== */}

        <div className="mt-6 space-y-2 border-t border-gray-200 pt-5 text-sm text-gray-500">
          <div>
            <strong>Secure Context:</strong>{" "}
            {window.isSecureContext
              ? "YES"
              : "NO"}
          </div>

          <div>
            <strong>Microphone API:</strong>{" "}
            {navigator.mediaDevices
              ?.getUserMedia
              ? "AVAILABLE"
              : "NOT AVAILABLE"}
          </div>

          <div>
            <strong>File Upload:</strong>{" "}
            SUPPORTED
          </div>

          <div>
            <strong>Vosk Endpoint:</strong>
            <br />
            {VOSK_ENDPOINT}
          </div>

          <div>
            <strong>Output Format:</strong>{" "}
            16kHz / Mono / 16-bit PCM WAV
          </div>
        </div>
      </div>
    </div>
  );
}
import { useEffect, useRef, useState } from "react";
import { transcribeAudio } from "../../services/api";

// ============================================================
// Float32 -> 16-bit PCM
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
// Downsample -> 16kHz
// ============================================================

function downsampleTo16k(float32Array, inputSampleRate) {
  const targetSampleRate = 16000;

  if (inputSampleRate === targetSampleRate) {
    return float32Array;
  }

  const ratio = inputSampleRate / targetSampleRate;

  const newLength = Math.round(float32Array.length / ratio);

  const result = new Float32Array(newLength);

  let resultOffset = 0;
  let inputOffset = 0;

  while (resultOffset < result.length) {
    const nextInputOffset = Math.round((resultOffset + 1) * ratio);

    let total = 0;
    let count = 0;

    for (
      let i = inputOffset;
      i < nextInputOffset && i < float32Array.length;
      i += 1
    ) {
      total += float32Array[i];
      count += 1;
    }

    result[resultOffset] = count > 0 ? total / count : 0;

    resultOffset += 1;
    inputOffset = nextInputOffset;
  }

  return result;
}

// ============================================================
// Create WAV
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

  writeString(8, "WAVE");

  // fmt
  writeString(12, "fmt ");

  view.setUint32(16, 16, true);

  // PCM
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
// Read transcript from response
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
// COMPONENT
// ============================================================

export default function VoskRecorder() {
  const [recording, setRecording] = useState(false);

  const [processing, setProcessing] = useState(false);

  const [status, setStatus] = useState("Ready");

  const [transcript, setTranscript] = useState("");

  const [error, setError] = useState("");

  // Microphone
  const rawStreamRef = useRef(null);

  // Audio context
  const audioContextRef = useRef(null);

  // Audio source
  const sourceRef = useRef(null);

  // Processor
  const processorRef = useRef(null);

  // Mute output
  const muteGainRef = useRef(null);

  // Audio chunks
  const chunksRef = useRef([]);

  // Actual browser sample rate
  const sampleRateRef = useRef(48000);

  // Internal recording state
  const recordingRef = useRef(false);

  // ==========================================================
  // CLEANUP
  // ==========================================================

  const cleanup = async () => {
    recordingRef.current = false;

    if (processorRef.current) {
      processorRef.current.onaudioprocess = null;

      processorRef.current.disconnect();

      processorRef.current = null;
    }

    if (sourceRef.current) {
      sourceRef.current.disconnect();

      sourceRef.current = null;
    }

    if (muteGainRef.current) {
      muteGainRef.current.disconnect();

      muteGainRef.current = null;
    }

    if (rawStreamRef.current) {
      rawStreamRef.current.getTracks().forEach((track) => {
        track.stop();
      });

      rawStreamRef.current = null;
    }

    if (audioContextRef.current) {
      const context = audioContextRef.current;

      audioContextRef.current = null;

      if (context.state !== "closed") {
        await context.close();
      }
    }
  };

  // ==========================================================
  // CLEANUP WHEN COMPONENT CLOSES
  // ==========================================================

  useEffect(() => {
    return () => {
      cleanup().catch((error) => {
        console.error("Audio cleanup error:", error);
      });
    };
  }, []);

  // ==========================================================
  // START RECORDING
  // ==========================================================

  const startRecording = async () => {
    try {
      setError("");
      setTranscript("");

      setStatus("Requesting microphone...");

      if (!window.isSecureContext) {
        throw new Error("Microphone requires a secure context.");
      }

      if (!navigator.mediaDevices?.getUserMedia) {
        throw new Error("Microphone API is not available.");
      }

      // ------------------------------------------------------
      // GET MICROPHONE
      // ------------------------------------------------------

      const rawStream = await navigator.mediaDevices.getUserMedia({
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

      const AudioContext = window.AudioContext || window.webkitAudioContext;

      if (!AudioContext) {
        throw new Error("Web Audio API is not supported.");
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

      const source = audioContext.createMediaStreamSource(rawStream);

      sourceRef.current = source;

      // ------------------------------------------------------
      // HIGH PASS
      // Removes low frequency rumble
      // ------------------------------------------------------

      const highPass = audioContext.createBiquadFilter();

      highPass.type = "highpass";

      highPass.frequency.value = 80;

      highPass.Q.value = 0.7;

      // ------------------------------------------------------
      // 50Hz HUM
      // ------------------------------------------------------

      const notch50 = audioContext.createBiquadFilter();

      notch50.type = "notch";

      notch50.frequency.value = 50;

      notch50.Q.value = 10;

      // ------------------------------------------------------
      // 100Hz HUM HARMONIC
      // ------------------------------------------------------

      const notch100 = audioContext.createBiquadFilter();

      notch100.type = "notch";

      notch100.frequency.value = 100;

      notch100.Q.value = 10;

      // ------------------------------------------------------
      // LOW PASS
      // Keeps speech range
      // ------------------------------------------------------

      const lowPass = audioContext.createBiquadFilter();

      lowPass.type = "lowpass";

      lowPass.frequency.value = 8000;

      lowPass.Q.value = 0.7;

      // ------------------------------------------------------
      // COMPRESSOR
      // Makes voice level stable
      // ------------------------------------------------------

      const compressor = audioContext.createDynamicsCompressor();

      compressor.threshold.value = -24;

      compressor.knee.value = 18;

      compressor.ratio.value = 3;

      compressor.attack.value = 0.005;

      compressor.release.value = 0.15;

      // ------------------------------------------------------
      // AUDIO PROCESSOR
      // ------------------------------------------------------

      const processor = audioContext.createScriptProcessor(4096, 1, 1);

      processorRef.current = processor;

      // ------------------------------------------------------
      // MUTE
      // Prevent microphone feedback
      // ------------------------------------------------------

      const muteGain = audioContext.createGain();

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

        const input = event.inputBuffer.getChannelData(0);

        chunksRef.current.push(new Float32Array(input));
      };

      // ------------------------------------------------------
      // AUDIO PIPELINE
      // ------------------------------------------------------

      source.connect(highPass);

      highPass.connect(notch50);

      notch50.connect(notch100);

      notch100.connect(lowPass);

      lowPass.connect(compressor);

      compressor.connect(processor);

      processor.connect(muteGain);

      muteGain.connect(audioContext.destination);

      // ------------------------------------------------------
      // START
      // ------------------------------------------------------

      recordingRef.current = true;

      setRecording(true);

      setStatus("Recording clean audio... Speak now.");
    } catch (error) {
      console.error("Microphone error:", error);

      await cleanup();

      setRecording(false);

      setStatus("Failed");

      setError(error?.message || "Could not start microphone.");
    }
  };

  // ==========================================================
  // STOP + SEND TO VOSK
  // ==========================================================

  const stopAndTranscribe = async () => {
    if (!recordingRef.current) {
      return;
    }

    try {
      setError("");

      setRecording(false);

      setProcessing(true);

      setStatus("Preparing audio...");

      // Stop collecting
      recordingRef.current = false;

      const chunks = chunksRef.current;

      if (!chunks.length) {
        throw new Error("No audio was captured.");
      }

      // ------------------------------------------------------
      // CALCULATE TOTAL AUDIO LENGTH
      // ------------------------------------------------------

      let totalLength = 0;

      for (const chunk of chunks) {
        totalLength += chunk.length;
      }

      // ------------------------------------------------------
      // COMBINE ALL AUDIO
      // ------------------------------------------------------

      const combined = new Float32Array(totalLength);

      let offset = 0;

      for (const chunk of chunks) {
        combined.set(chunk, offset);

        offset += chunk.length;
      }

      // ------------------------------------------------------
      // CONVERT TO 16kHz
      // ------------------------------------------------------

      const originalSampleRate = sampleRateRef.current;

      const mono16k = downsampleTo16k(combined, originalSampleRate);

      // ------------------------------------------------------
      // CREATE WAV
      // ------------------------------------------------------

      const wavBlob = encodeWav(mono16k, 16000);

      console.log("WAV size:", wavBlob.size, "bytes");

      // ------------------------------------------------------
      // CLOSE MICROPHONE
      // ------------------------------------------------------

      await cleanup();

      // ------------------------------------------------------
      // SEND TO SERVER
      // ------------------------------------------------------

      setStatus("Sending audio to Vosk...");

      const response = await transcribeAudio(wavBlob);

      console.log("Vosk response:", response);

      // ------------------------------------------------------
      // GET TEXT
      // ------------------------------------------------------

      const text = getTranscript(response);

      if (!text) {
        throw new Error(
          "Vosk response received, but transcript text was not found.",
        );
      }

      setTranscript(text);

      setStatus("Transcription complete.");
    } catch (error) {
      console.error("Transcription error:", error);

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
  // CANCEL
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
    <div className="flex items-center justify-center bg-gray-100 p-6">
      <div className="w-full max-w-2xl rounded-2xl bg-white p-6 shadow-lg">
        <h1 className="text-2xl font-bold text-gray-900">Voice to Vosk</h1>

        <p className="mt-2 text-gray-600">
          Microphone → Clean Audio → 16kHz WAV → Vosk Server
        </p>

        {/* BUTTONS */}

        <div className="mt-6 flex gap-3">
          {!recording ? (
            <button
              onClick={startRecording}
              disabled={processing}
              className="flex-1 rounded-xl bg-black px-5 py-3 font-medium text-white hover:bg-gray-800 disabled:cursor-not-allowed disabled:opacity-50"
            >
              {processing ? "Processing..." : "Start Microphone"}
            </button>
          ) : (
            <button
              onClick={stopAndTranscribe}
              className="flex-1 rounded-xl bg-black px-5 py-3 font-medium text-white hover:bg-gray-800"
            >
              Stop & Transcribe
            </button>
          )}

          {recording && (
            <button
              onClick={cancelRecording}
              className="rounded-xl border border-gray-300 px-5 py-3 font-medium text-gray-800 hover:bg-gray-100"
            >
              Cancel
            </button>
          )}
        </div>

        {/* STATUS */}

        <div className="mt-5 rounded-xl bg-gray-50 p-4">
          <div className="font-semibold text-gray-900">Status</div>

          <div className="mt-1 text-gray-700">{status}</div>
        </div>

        {/* TRANSCRIPT */}

        {transcript && (
          <div className="mt-5 rounded-xl border border-gray-200 p-4">
            <div className="font-semibold text-gray-900">Vosk Transcript</div>

            <p className="mt-2 text-lg text-gray-700">{transcript}</p>
          </div>
        )}

        {/* ERROR */}

        {error && (
          <div className="mt-5 rounded-xl bg-red-50 p-4 text-red-700">
            {error}
          </div>
        )}

        {/* DEBUG */}

        <div className="mt-6 space-y-1 border-t border-gray-200 pt-4 text-sm text-gray-500">
          <div>Secure Context: {window.isSecureContext ? "YES" : "NO"}</div>

          <div>
            Microphone API:{" "}
            {navigator.mediaDevices?.getUserMedia
              ? "AVAILABLE"
              : "NOT AVAILABLE"}
          </div>

          <div>
            Vosk Endpoint:
            <br />
            http://192.168.1.57:3000/api/vosk/transcribe
          </div>
        </div>
      </div>
    </div>
  );
}

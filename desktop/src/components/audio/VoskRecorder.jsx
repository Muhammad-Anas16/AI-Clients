import { useState } from "react";

import { transcribeAudio } from "../../services/api";

import { getTranscript } from "../../utils/audioUtils";

import MicrophoneRecorder from "./MicrophoneRecorder";
import AudioFileUploader from "./AudioFileUploader";

export default function VoskRecorder() {
  const [processing, setProcessing] = useState(false);

  const [status, setStatus] = useState("Ready");

  const [transcript, setTranscript] = useState("");

  const [error, setError] = useState("");

  // ==========================================================
  // SEND WAV TO VOSK
  // ==========================================================

  const handleTranscribe = async (wavBlob, source) => {
    try {
      setError("");
      setTranscript("");
      setProcessing(true);

      setStatus(`Sending ${source} to Vosk...`);

      const response = await transcribeAudio(wavBlob);

      console.log("Vosk response:", response);

      const text = getTranscript(response);

      if (!text) {
        throw new Error("Transcript text was not found.");
      }

      setTranscript(text);

      setStatus("Transcription complete.");
    } catch (error) {
      console.error("Vosk transcription error:", error);

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

  return (
    <div className="min-h-screen bg-gray-100 p-6">
      <div className="mx-auto max-w-3xl rounded-2xl bg-white p-6 shadow-lg">
        <h1 className="text-2xl font-bold">Voice to Vosk</h1>

        <p className="mt-2 text-gray-600">
          Microphone ya recorded audio → 16kHz WAV → Vosk Server
        </p>

        {/* AUDIO FLOW */}

        <div className="mt-6 rounded-xl bg-gray-50 p-4 text-sm text-gray-600">
          <div className="font-semibold text-gray-900">Flow</div>

          <div className="mt-2">
            🎤 Microphone → Clean Audio → 16kHz WAV → Vosk → Text
          </div>

          <div>📁 Recorded File → Decode → Mono → 16kHz WAV → Vosk → Text</div>
        </div>

        {/* MICROPHONE */}

        <div className="mt-6">
          <MicrophoneRecorder
            onTranscribe={handleTranscribe}
            onStatus={setStatus}
            processing={processing}
          />
        </div>

        {/* FILE UPLOAD */}

        <div className="mt-6">
          <AudioFileUploader
            onTranscribe={handleTranscribe}
            onStatus={setStatus}
            processing={processing}
          />
        </div>

        {/* STATUS */}

        <div className="mt-6 rounded-xl bg-gray-50 p-4">
          <div className="font-semibold">Status</div>

          <div className="mt-1 text-gray-700">{status}</div>
        </div>

        {/* TRANSCRIPT */}

        {transcript && (
          <div className="mt-6 rounded-xl border p-5">
            <div className="font-semibold">Vosk Transcript</div>

            <p className="mt-2 text-lg text-gray-700">{transcript}</p>
          </div>
        )}

        {/* ERROR */}

        {error && (
          <div className="mt-6 rounded-xl bg-red-50 p-4 text-red-700">
            <div className="font-semibold">Error</div>

            <div className="mt-1">{error}</div>
          </div>
        )}
      </div>
    </div>
  );
}

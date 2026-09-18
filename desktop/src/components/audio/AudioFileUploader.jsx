import { useRef, useState } from "react";

import {
  decodeAudioFileToMono,
  encodeWav,
  resampleTo16k,
} from "../../utils/audioUtils";

export default function AudioFileUploader({
  onTranscribe,
  onStatus,
  processing,
}) {
  const [file, setFile] = useState(null);

  const inputRef = useRef(null);

  const handleChange = (event) => {
    const selected = event.target.files?.[0];

    if (!selected) {
      setFile(null);
      return;
    }

    setFile(selected);

    onStatus("Recorded audio selected.");
  };

  const upload = async () => {
    if (!file) {
      onStatus("Please select an audio file.");
      return;
    }

    try {
      onStatus("Reading recorded audio...");

      const decoded = await decodeAudioFileToMono(file);

      onStatus("Converting to 16kHz mono WAV...");

      const mono16k = resampleTo16k(decoded.samples, decoded.sampleRate);

      const wavBlob = encodeWav(mono16k, 16000);

      await onTranscribe(wavBlob, "recorded audio");
    } catch (error) {
      onStatus(error?.message || "Could not process audio file.");

      console.error(error);
    }
  };

  const clear = () => {
    setFile(null);

    if (inputRef.current) {
      inputRef.current.value = "";
    }

    onStatus("Ready");
  };

  return (
    <div className="rounded-2xl border border-gray-200 p-5">
      <h2 className="text-lg font-bold">Recorded Voice</h2>

      <p className="mt-1 text-sm text-gray-500">
        MP3, WAV, M4A, WEBM, OGG waghera select karo.
      </p>

      <input
        ref={inputRef}
        type="file"
        accept="audio/*,.wav,.mp3,.m4a,.webm,.ogg"
        onChange={handleChange}
        disabled={processing}
        className="mt-4 block w-full rounded-xl border p-3"
      />

      {file && (
        <div className="mt-4 rounded-xl bg-gray-50 p-4">
          <div className="break-all text-sm font-medium">{file.name}</div>

          <div className="mt-1 text-xs text-gray-500">
            {(file.size / 1024 / 1024).toFixed(2)} MB
          </div>

          <div className="mt-4 flex gap-3">
            <button
              onClick={upload}
              disabled={processing}
              className="flex-1 rounded-xl bg-black px-5 py-3 text-white disabled:opacity-50"
            >
              📤 Upload & Transcribe
            </button>

            <button
              onClick={clear}
              disabled={processing}
              className="rounded-xl border px-5 py-3"
            >
              Remove
            </button>
          </div>
        </div>
      )}
    </div>
  );
}

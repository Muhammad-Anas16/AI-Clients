import { useEffect, useRef, useState } from "react";

import { encodeWav, resampleTo16k } from "../../utils/audioUtils";

export default function MicrophoneRecorder({
  onTranscribe,
  onStatus,
  processing,
}) {
  const [recording, setRecording] = useState(false);

  const streamRef = useRef(null);
  const contextRef = useRef(null);
  const sourceRef = useRef(null);
  const processorRef = useRef(null);
  const muteRef = useRef(null);

  const chunksRef = useRef([]);
  const sampleRateRef = useRef(48000);
  const recordingRef = useRef(false);

  const cleanup = async () => {
    recordingRef.current = false;
    setRecording(false);

    if (processorRef.current) {
      processorRef.current.onaudioprocess = null;
      processorRef.current.disconnect();
      processorRef.current = null;
    }

    if (sourceRef.current) {
      sourceRef.current.disconnect();
      sourceRef.current = null;
    }

    if (muteRef.current) {
      muteRef.current.disconnect();
      muteRef.current = null;
    }

    if (streamRef.current) {
      streamRef.current.getTracks().forEach((track) => track.stop());

      streamRef.current = null;
    }

    if (contextRef.current) {
      const context = contextRef.current;
      contextRef.current = null;

      if (context.state !== "closed") {
        await context.close();
      }
    }
  };

  useEffect(() => {
    return () => {
      cleanup().catch(console.error);
    };
  }, []);

  const startRecording = async () => {
    try {
      onStatus("Requesting microphone...");

      if (!window.isSecureContext) {
        throw new Error("Microphone requires HTTPS or localhost.");
      }

      if (!navigator.mediaDevices?.getUserMedia) {
        throw new Error("Microphone API is not available.");
      }

      const stream = await navigator.mediaDevices.getUserMedia({
        audio: {
          channelCount: 1,
          echoCancellation: true,
          noiseSuppression: true,
          autoGainControl: true,
        },
      });

      streamRef.current = stream;

      const AudioContext = window.AudioContext || window.webkitAudioContext;

      if (!AudioContext) {
        throw new Error("Web Audio API is not supported.");
      }

      const context = new AudioContext();

      contextRef.current = context;
      sampleRateRef.current = context.sampleRate;

      if (context.state === "suspended") {
        await context.resume();
      }

      const source = context.createMediaStreamSource(stream);

      sourceRef.current = source;

      const highPass = context.createBiquadFilter();

      highPass.type = "highpass";
      highPass.frequency.value = 80;

      const notch50 = context.createBiquadFilter();

      notch50.type = "notch";
      notch50.frequency.value = 50;
      notch50.Q.value = 10;

      const notch100 = context.createBiquadFilter();

      notch100.type = "notch";
      notch100.frequency.value = 100;
      notch100.Q.value = 10;

      const lowPass = context.createBiquadFilter();

      lowPass.type = "lowpass";
      lowPass.frequency.value = 8000;

      const compressor = context.createDynamicsCompressor();

      compressor.threshold.value = -24;
      compressor.knee.value = 18;
      compressor.ratio.value = 3;
      compressor.attack.value = 0.005;
      compressor.release.value = 0.15;

      const processor = context.createScriptProcessor(4096, 1, 1);

      processorRef.current = processor;

      const mute = context.createGain();

      mute.gain.value = 0;
      muteRef.current = mute;

      chunksRef.current = [];

      processor.onaudioprocess = (event) => {
        if (!recordingRef.current) return;

        const input = event.inputBuffer.getChannelData(0);

        chunksRef.current.push(new Float32Array(input));
      };

      source.connect(highPass);
      highPass.connect(notch50);
      notch50.connect(notch100);
      notch100.connect(lowPass);
      lowPass.connect(compressor);
      compressor.connect(processor);
      processor.connect(mute);
      mute.connect(context.destination);

      recordingRef.current = true;
      setRecording(true);

      onStatus("Recording... Speak now.");
    } catch (error) {
      await cleanup();
      throw error;
    }
  };

  const stopRecording = async () => {
    if (!recordingRef.current) return;

    recordingRef.current = false;
    setRecording(false);

    onStatus("Preparing microphone audio...");

    const chunks = chunksRef.current;

    if (!chunks.length) {
      await cleanup();

      throw new Error("No audio was captured.");
    }

    let totalLength = 0;

    for (const chunk of chunks) {
      totalLength += chunk.length;
    }

    const combined = new Float32Array(totalLength);

    let offset = 0;

    for (const chunk of chunks) {
      combined.set(chunk, offset);
      offset += chunk.length;
    }

    const mono16k = resampleTo16k(combined, sampleRateRef.current);

    const wavBlob = encodeWav(mono16k, 16000);

    await cleanup();

    await onTranscribe(wavBlob, "microphone audio");
  };

  const cancel = async () => {
    await cleanup();
    onStatus("Stopped");
  };

  return (
    <div className="rounded-2xl border border-gray-200 p-5">
      <h2 className="text-lg font-bold">Live Microphone</h2>

      <p className="mt-1 text-sm text-gray-500">
        Direct microphone se voice record karo.
      </p>

      <div className="mt-4 flex gap-3">
        {!recording ? (
          <button
            onClick={async () => {
              try {
                await startRecording();
              } catch (error) {
                onStatus("Failed");
                console.error(error);
              }
            }}
            disabled={processing}
            className="flex-1 rounded-xl bg-black px-5 py-3 text-white disabled:opacity-50"
          >
            🎤 Start Microphone
          </button>
        ) : (
          <button
            onClick={async () => {
              try {
                await stopRecording();
              } catch (error) {
                onStatus("Failed");
                console.error(error);
              }
            }}
            disabled={processing}
            className="flex-1 rounded-xl bg-black px-5 py-3 text-white"
          >
            ⏹ Stop & Transcribe
          </button>
        )}

        {recording && (
          <button
            onClick={cancel}
            disabled={processing}
            className="rounded-xl border px-5 py-3"
          >
            Cancel
          </button>
        )}
      </div>
    </div>
  );
}

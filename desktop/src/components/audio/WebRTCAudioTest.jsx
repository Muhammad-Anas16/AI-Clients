import { useRef, useState } from "react";

import { createWebRTCAudioLoopback } from "./createWebRTCAudioLoopback";

export default function WebRTCAudioTest() {
  const audioRef = useRef(null);

  const connectionRef = useRef(null);

  const [running, setRunning] = useState(false);

  const [status, setStatus] = useState("Ready");

  const [error, setError] = useState("");

  const start = async () => {
    try {
      setError("");

      setStatus("Requesting microphone...");

      const connection = await createWebRTCAudioLoopback(audioRef.current);

      connectionRef.current = connection;

      setRunning(true);

      setStatus("Microphone active. Speak now.");
    } catch (err) {
      console.error(err);

      setRunning(false);

      setError(err?.message || "Microphone failed.");

      setStatus("Failed");
    }
  };

  const stop = () => {
    connectionRef.current?.stop();

    connectionRef.current = null;

    setRunning(false);

    setStatus("Stopped");
  };

  return (
    <div
      style={{
        minHeight: "100vh",
        display: "flex",
        alignItems: "center",
        justifyContent: "center",
        background: "#111",
        padding: 20,
      }}
    >
      <div
        style={{
          width: "100%",
          maxWidth: 500,
          background: "#fff",
          borderRadius: 20,
          padding: 30,
        }}
      >
        <h1>JARVIS Audio Test</h1>

        <p>Microphone → Clean Audio → WebRTC → Speaker</p>

        <audio ref={audioRef} autoPlay playsInline />

        {!running ? (
          <button
            onClick={start}
            style={{
              width: "100%",
              padding: 15,
              marginTop: 20,
              cursor: "pointer",
            }}
          >
            Start Microphone
          </button>
        ) : (
          <button
            onClick={stop}
            style={{
              width: "100%",
              padding: 15,
              marginTop: 20,
              cursor: "pointer",
            }}
          >
            Stop
          </button>
        )}

        <div
          style={{
            marginTop: 20,
          }}
        >
          <strong>Status</strong>

          <p>{status}</p>
        </div>

        {error && (
          <div
            style={{
              padding: 12,
              marginTop: 10,
              background: "#ffe5e5",
              color: "#900",
              borderRadius: 10,
            }}
          >
            {error}
          </div>
        )}

        <hr />

        <div>Secure Context: {window.isSecureContext ? "YES" : "NO"}</div>

        <div>
          mediaDevices: {navigator.mediaDevices ? "AVAILABLE" : "NOT AVAILABLE"}
        </div>

        <div>
          getUserMedia:{" "}
          {navigator.mediaDevices?.getUserMedia ? "AVAILABLE" : "NOT AVAILABLE"}
        </div>

        <div>Origin: {window.location.origin}</div>
      </div>
    </div>
  );
}

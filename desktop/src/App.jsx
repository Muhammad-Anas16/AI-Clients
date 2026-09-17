import { useCallback, useEffect, useState } from "react";
import "./App.css";

import api from "./services/api.js";
import {
  startRealtimeVoice,
  stopRealtimeVoice,
} from "./services/realtimeVoice.js";

function App() {
  const [serverOnline, setServerOnline] = useState(false);

  const [voiceState, setVoiceState] = useState("starting");

  const [partialText, setPartialText] = useState("");

  const [commandText, setCommandText] = useState("");

  const [answerText, setAnswerText] = useState("");

  const [errorText, setErrorText] = useState("");

  const [manualPrompt, setManualPrompt] = useState("");

  const [manualLoading, setManualLoading] = useState(false);

  const [screenshotLoading, setScreenshotLoading] = useState(false);

  // VOICE EVENTS
  const handleVoiceEvent = useCallback((event) => {
    if (!event) return;

    switch (event.type) {
      case "state":
        setVoiceState(event.state || "unknown");
        break;

      case "partial":
        setPartialText(event.text || "");
        break;

      case "command":
        setCommandText(event.text || "");
        setPartialText("");
        break;

      case "answer":
        setAnswerText(event.text || "");
        break;

      case "error":
        setErrorText(event.message || "Voice error");
        setVoiceState("error");
        break;

      default:
        break;
    }
  }, []);
  // START JARVIS
  const startJarvis = useCallback(async () => {
    setErrorText("");
    setVoiceState("connecting");

    try {
      const online = await api.checkServer();

      if (!online) {
        setServerOnline(false);
        setVoiceState("server_offline");

        throw new Error("JARVIS server is not running.");
      }

      setServerOnline(true);

      await startRealtimeVoice(handleVoiceEvent);
    } catch (error) {
      setServerOnline(false);
      setVoiceState("error");

      setErrorText(error?.message || "Could not start JARVIS.");
    }
  }, [handleVoiceEvent]);

  // STOP JARVIS
  const stopJarvis = useCallback(async () => {
    try {
      await stopRealtimeVoice();
    } catch {}

    setVoiceState("stopped");
    setPartialText("");
  }, []);
  // INITIAL START
  useEffect(() => {
    let mounted = true;
    let timer = null;

    async function boot() {
      for (let attempt = 0; attempt < 30 && mounted; attempt += 1) {
        try {
          const online = await api.checkServer();

          if (online) {
            setServerOnline(true);

            await startRealtimeVoice(handleVoiceEvent);

            return;
          }
        } catch {
          // Server may still be starting.
        }

        await new Promise((resolve) => {
          timer = setTimeout(resolve, 1000);
        });
      }

      if (mounted) {
        setServerOnline(false);
        setVoiceState("server_offline");
      }
    }

    boot();

    return () => {
      mounted = false;

      if (timer) {
        clearTimeout(timer);
      }

      stopRealtimeVoice().catch(() => {});
    };
  }, [handleVoiceEvent]);

  // MANUAL TEXT CHAT
  async function sendChat() {
    const prompt = manualPrompt.trim();

    if (!prompt || manualLoading) {
      return;
    }

    setManualLoading(true);
    setErrorText("");
    setCommandText(prompt);
    setAnswerText("");

    try {
      const response = await api.chat(prompt);

      const answer = response?.data?.answer || "";

      setAnswerText(answer);
    } catch (error) {
      setErrorText(error?.message || "LLaMA request failed.");
    } finally {
      setManualLoading(false);
    }
  }

  // SCREENSHOT + OCR
  async function readScreen() {
    if (screenshotLoading) {
      return;
    }

    setScreenshotLoading(true);
    setErrorText("");
    setAnswerText("");

    try {
      const response = await api.screenshotOcr({
        askLlama: true,
        question: "What is visible on my screen? Give a concise answer.",
        includeImage: false,
        language: "eng",
      });

      const answer = response?.data?.llamaAnswer || response?.data?.text || "";

      setAnswerText(answer);
    } catch (error) {
      setErrorText(error?.message || "Screenshot/OCR failed.");
    } finally {
      setScreenshotLoading(false);
    }
  }

  // STATUS TEXT
  function readableState(state) {
    const states = {
      starting: "Starting...",
      connecting: "Connecting...",
      connecting_voice: "Connecting voice...",
      waiting_for_wake_word: "Waiting for wake word",
      wake_detected: "Wake word detected",
      thinking: "Thinking...",
      speaking: "Speaking...",
      stopped: "Stopped",
      server_offline: "Server offline",
      error: "Error",
      unknown: "Unknown",
    };

    return states[state] || state;
  }

  const listening = voiceState === "waiting_for_wake_word";
  const thinking = voiceState === "thinking";
  const speaking = voiceState === "speaking";

  return (
    <main className="app">
      <section className="card">
        {/* HEADER */}
        <div className="top">
          <div>
            <p className="eyebrow">JARVIS</p>

            <h1>Local AI Assistant</h1>
          </div>

          <div className={`dot ${serverOnline ? "online" : ""}`} />
        </div>
        {/* SERVER STATUS */}
        <div className="state">
          <span>Server</span>

          <strong>{serverOnline ? "Online" : "Offline"}</strong>
        </div>
        {/* VOICE STATUS */}
        <div className="state">
          <span>Voice</span>

          <strong>{readableState(voiceState)}</strong>
        </div>
        {/* MAIN CONTROLS */}
        <div className="actions">
          <button
            onClick={startJarvis}
            disabled={!serverOnline || listening || thinking || speaking}
          >
            Start Listening
          </button>

          <button className="secondary" onClick={stopJarvis}>
            Stop
          </button>
        </div>
        {/* WAKE WORD */}
        <div className="box">
          <label>WAKE WORD</label>

          <p>
            Say <b>"Jarvis"</b> to activate.
          </p>
        </div>
        {/* LIVE PARTIAL */}
        {partialText && (
          <div className="box">
            <label>LISTENING</label>

            <p>{partialText}</p>
          </div>
        )}
        {/* COMMAND */}
        {commandText && (
          <div className="box">
            <label>COMMAND</label>

            <p>{commandText}</p>
          </div>
        )}
        {/* ANSWER */}
        {answerText && (
          <div className="box answer">
            <label>JARVIS</label>

            <p>{answerText}</p>
          </div>
        )}
        {/* MANUAL CHAT */}
        <div className="box">
          <label>TEXT CHAT</label>

          <input
            type="text"
            value={manualPrompt}
            onChange={(event) => setManualPrompt(event.target.value)}
            onKeyDown={(event) => {
              if (event.key === "Enter") {
                sendChat();
              }
            }}
            placeholder="Ask JARVIS..."
            disabled={manualLoading}
            style={{
              width: "100%",
              padding: "12px",
              borderRadius: "10px",
              border: "1px solid #27272a",
              background: "#09090b",
              color: "#fff",
              outline: "none",
            }}
          />

          <div
            className="actions"
            style={{
              marginTop: "10px",
            }}
          >
            <button
              onClick={sendChat}
              disabled={manualLoading || !manualPrompt.trim()}
            >
              {manualLoading ? "Thinking..." : "Send"}
            </button>
          </div>
        </div>
        {/* SCREEN */}
        <div className="actions">
          <button
            className="secondary"
            onClick={readScreen}
            disabled={screenshotLoading}
          >
            {screenshotLoading ? "Reading Screen..." : "Read Screen"}
          </button>
        </div>

        {/* ERROR */}
        {errorText && <div className="error">{errorText}</div>}
        {/* FOOTER */}
        <p className="hint">
          JARVIS server: <b>127.0.0.1:3000</b>
        </p>

        <p className="hint">
          Vosk listens continuously until JARVIS detects the wake word.
        </p>
      </section>
    </main>
  );
}

export default App;

import { useCallback, useEffect, useState } from "react";
import "./App.css";

import api from "./services/api.js";
import realtimeVoice from "./services/realtimeVoice.js";

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

  const handleVoiceEvent = useCallback((event) => {
    if (!event) return;

    switch (event.type) {
      case "state":
        setVoiceState(event.state || "unknown");
        break;

      case "partial":
        setPartialText(event.text || "");
        break;

      case "wake":
        setVoiceState("wake_detected");
        break;

      case "command":
        setCommandText(event.text || "");
        setPartialText("");
        break;

      case "answer":
        setAnswerText(event.text || "");
        break;

      case "error":
        setErrorText(event.message || "Voice error.");
        setVoiceState("error");
        break;

      default:
        break;
    }
  }, []);

  const startJarvis = useCallback(async () => {
    setErrorText("");
    setPartialText("");
    setVoiceState("connecting");

    try {
      const online = await api.checkServer();

      if (!online) {
        setServerOnline(false);
        setVoiceState("server_offline");

        throw new Error(
          `JARVIS server is not reachable at ${api.API_BASE_URL}.`,
        );
      }

      setServerOnline(true);

      await realtimeVoice.startRealtimeVoice(handleVoiceEvent);
    } catch (error) {
      setVoiceState("error");

      setErrorText(error?.message || "Could not start JARVIS.");
    }
  }, [handleVoiceEvent]);

  const stopJarvis = useCallback(async () => {
    try {
      await realtimeVoice.stopRealtimeVoice();
    } catch (error) {
      setErrorText(error?.message || "Could not stop JARVIS.");
    }

    setVoiceState("stopped");
    setPartialText("");
  }, []);

  useEffect(() => {
    let mounted = true;

    async function boot() {
      setVoiceState("starting");
      setErrorText("");

      for (let attempt = 0; attempt < 10 && mounted; attempt += 1) {
        const online = await api.checkServer();

        if (online) {
          if (!mounted) return;

          setServerOnline(true);

          try {
            await realtimeVoice.startRealtimeVoice(handleVoiceEvent);
          } catch (error) {
            if (!mounted) return;

            setVoiceState("error");

            setErrorText(error?.message || "Could not start JARVIS voice.");
          }

          return;
        }

        await new Promise((resolve) => setTimeout(resolve, 1000));
      }

      if (mounted) {
        setServerOnline(false);
        setVoiceState("server_offline");
      }
    }

    boot();

    return () => {
      mounted = false;

      realtimeVoice.stopRealtimeVoice().catch(() => {});
    };
  }, [handleVoiceEvent]);

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

      setAnswerText(answer || "Server returned no answer.");
    } catch (error) {
      setErrorText(error?.message || "LLaMA request failed.");
    } finally {
      setManualLoading(false);
    }
  }

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

      const answer =
        response?.data?.llamaAnswer ||
        response?.data?.text ||
        "No OCR/LLaMA answer returned.";

      setAnswerText(answer);
    } catch (error) {
      setErrorText(error?.message || "Screenshot/OCR failed.");
    } finally {
      setScreenshotLoading(false);
    }
  }

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
        <div className="top">
          <div>
            <p className="eyebrow">JARVIS</p>

            <h1>Local AI Assistant</h1>
          </div>

          <div className={`dot ${serverOnline ? "online" : ""}`} />
        </div>

        <div className="state">
          <span>Server</span>

          <strong>{serverOnline ? "Online" : "Offline"}</strong>
        </div>

        <div className="state">
          <span>Voice</span>

          <strong>{readableState(voiceState)}</strong>
        </div>

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

        <div className="box">
          <label>WAKE WORD</label>

          <p>
            Say <b>"Jarvis"</b> to activate.
          </p>
        </div>

        {partialText && (
          <div className="box">
            <label>LISTENING</label>

            <p>{partialText}</p>
          </div>
        )}

        {commandText && (
          <div className="box">
            <label>COMMAND</label>

            <p>{commandText}</p>
          </div>
        )}

        {answerText && (
          <div className="box answer">
            <label>JARVIS</label>

            <p>{answerText}</p>
          </div>
        )}

        <div className="box">
          <label>TEXT CHAT</label>

          <input
            type="text"
            value={manualPrompt}
            onChange={(event) => setManualPrompt(event.target.value)}
            onKeyDown={(event) => {
              if (event.key === "Enter") {
                void sendChat();
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
              onClick={() => void sendChat()}
              disabled={manualLoading || !manualPrompt.trim()}
            >
              {manualLoading ? "Thinking..." : "Send"}
            </button>
          </div>
        </div>

        <div className="actions">
          <button
            className="secondary"
            onClick={() => void readScreen()}
            disabled={screenshotLoading}
          >
            {screenshotLoading ? "Reading Screen..." : "Read Screen"}
          </button>
        </div>

        {errorText && <div className="error">{errorText}</div>}

        <p className="hint">
          JARVIS server: <b>{api.API_BASE_URL}</b>
        </p>

        <p className="hint">
          Voice uses the browser microphone and server WebSocket.
        </p>
      </section>
    </main>
  );
}

export default App;

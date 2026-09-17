import {
  useCallback,
  useEffect,
  useState,
} from "react";

import api from "./services/api.js";
import {
  API_BASE_URL,
} from "./services/api.js";
import {
  startRealtimeVoice,
  stopRealtimeVoice,
} from "./services/realtimeVoice.js";

import Header from "./components/Header.jsx";
import StatusPanel from "./components/StatusPanel.jsx";
import VoiceControls from "./components/VoiceControls.jsx";
import ConversationPanel from "./components/ConversationPanel.jsx";
import ChatPanel from "./components/ChatPanel.jsx";
import ScreenPanel from "./components/ScreenPanel.jsx";

import "./App.css";

const App = () => {
  const [serverOnline, setServerOnline] =
    useState(false);

  const [voiceState, setVoiceState] =
    useState("starting");

  const [partialText, setPartialText] =
    useState("");

  const [commandText, setCommandText] =
    useState("");

  const [answerText, setAnswerText] =
    useState("");

  const [errorText, setErrorText] =
    useState("");

  const [manualLoading, setManualLoading] =
    useState(false);

  const [screenshotLoading, setScreenshotLoading] =
    useState(false);

  const handleVoiceEvent = useCallback(
    (event) => {
      if (!event) {
        return;
      }

      switch (event.type) {
        case "state":
          setVoiceState(
            event.state || "unknown",
          );
          break;

        case "partial":
          setPartialText(event.text || "");
          break;

        case "wake":
          setErrorText("");
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
          setErrorText(
            event.message || "Voice error.",
          );
          setVoiceState("error");
          break;

        default:
          break;
      }
    },
    [],
  );

  const startJarvis = useCallback(
    async () => {
      setErrorText("");
      setVoiceState("connecting");

      try {
        const online =
          await api.checkServer();

        if (!online) {
          setServerOnline(false);
          setVoiceState("server_offline");

          throw new Error(
            "JARVIS server is not running.",
          );
        }

        setServerOnline(true);

        await startRealtimeVoice(
          handleVoiceEvent,
        );
      } catch (error) {
        setServerOnline(false);
        setVoiceState("error");
        setErrorText(
          error?.message ||
            "Could not start JARVIS.",
        );
      }
    },
    [handleVoiceEvent],
  );

  const stopJarvis = useCallback(
    async () => {
      await stopRealtimeVoice().catch(
        () => {},
      );

      setVoiceState("stopped");
      setPartialText("");
    },
    [],
  );

  useEffect(() => {
    let mounted = true;
    let timer = null;

    const boot = async () => {
      for (
        let attempt = 0;
        attempt < 30 && mounted;
        attempt += 1
      ) {
        const online =
          await api.checkServer();

        if (online) {
          if (!mounted) {
            return;
          }

          setServerOnline(true);

          try {
            await startRealtimeVoice(
              handleVoiceEvent,
            );
          } catch {}

          return;
        }

        await new Promise(
          (resolve) => {
            timer = setTimeout(
              resolve,
              1000,
            );
          },
        );
      }

      if (mounted) {
        setServerOnline(false);
        setVoiceState("server_offline");
      }
    };

    void boot();

    return () => {
      mounted = false;

      if (timer) {
        clearTimeout(timer);
      }

      void stopRealtimeVoice();
    };
  }, [handleVoiceEvent]);

  const sendChat = async (prompt) => {
    setManualLoading(true);
    setErrorText("");
    setCommandText(prompt);
    setAnswerText("");

    try {
      const response = await api.chat(
        prompt,
      );

      setAnswerText(
        response?.data?.answer || "",
      );
    } catch (error) {
      setErrorText(
        error?.message ||
          "LLaMA request failed.",
      );
    } finally {
      setManualLoading(false);
    }
  };

  const readScreen = async () => {
    if (screenshotLoading) {
      return;
    }

    setScreenshotLoading(true);
    setErrorText("");
    setAnswerText("");

    try {
      const response =
        await api.screenshotOcr({
          askLlama: true,
          question:
            "What is visible on my screen? Give a concise answer.",
          includeImage: false,
          language: "eng",
        });

      setAnswerText(
        response?.data?.llamaAnswer ||
          response?.data?.text ||
          "",
      );
    } catch (error) {
      setErrorText(
        error?.message ||
          "Screenshot/OCR failed.",
      );
    } finally {
      setScreenshotLoading(false);
    }
  };

  const voiceActiveStates = [
    "starting",
    "connecting",
    "waiting_for_wake_word",
    "waiting_for_command",
    "wake_detected",
    "transcribing_command",
    "thinking",
    "speaking",
  ];

  const voiceActive =
    voiceActiveStates.includes(
      voiceState,
    );

  return (
    <main className="app-shell">
      <div className="app-container">
        <Header
          serverOnline={serverOnline}
        />

        <StatusPanel
          serverOnline={serverOnline}
          voiceState={voiceState}
          serverUrl={API_BASE_URL}
        />

        <VoiceControls
          onStart={startJarvis}
          onStop={stopJarvis}
          canStart={
            serverOnline &&
            !voiceActive
          }
          canStop={serverOnline}
        />

        <section className="wake-card">
          <span className="message-label">
            WAKE WORD
          </span>

          <p>
            Say <strong>"Jarvis"</strong> to
            activate command mode.
          </p>

          <small>
            Audio is captured natively by Tauri
            and sent to the existing REST Vosk
            endpoint in short WAV windows.
          </small>
        </section>

        <ConversationPanel
          partialText={partialText}
          commandText={commandText}
          answerText={answerText}
        />

        <div className="section-grid">
          <ChatPanel
            onSend={sendChat}
            loading={manualLoading}
          />

          <ScreenPanel
            onReadScreen={readScreen}
            loading={screenshotLoading}
          />
        </div>

        {errorText && (
          <section className="error-card">
            <span>ERROR</span>
            <p>{errorText}</p>
          </section>
        )}

        <footer className="footer">
          <span>
            JARVIS Desktop • Server:{" "}
            {API_BASE_URL}
          </span>

          <span>
            REST voice mode — no server changes
          </span>
        </footer>
      </div>
    </main>
  );
};

export default App;

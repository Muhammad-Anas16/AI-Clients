const StatusPanel = ({
  serverOnline,
  voiceState,
  serverUrl,
}) => {
  const stateLabels = {
    starting: "Starting...",
    connecting: "Connecting...",
    waiting_for_wake_word:
      "Waiting for wake word",
    waiting_for_command:
      "Waiting for command",
    transcribing_command:
      "Transcribing command",
    wake_detected: "Wake word detected",
    thinking: "Thinking...",
    speaking: "Speaking...",
    stopped: "Stopped",
    server_offline: "Server offline",
    error: "Error",
  };

  const label =
    stateLabels[voiceState] ||
    voiceState ||
    "Unknown";

  return (
    <section className="status-grid">
      <div className="status-card">
        <span>SERVER</span>
        <strong>
          {serverOnline ? "Online" : "Offline"}
        </strong>
        <small>{serverUrl}</small>
      </div>

      <div className="status-card">
        <span>VOICE</span>
        <strong>{label}</strong>
        <small>
          Native microphone + REST Vosk
        </small>
      </div>
    </section>
  );
};

export default StatusPanel;

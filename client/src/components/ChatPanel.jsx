import { useState } from "react";

const ChatPanel = ({
  onSend,
  loading,
}) => {
  const [prompt, setPrompt] = useState("");

  const submit = async () => {
    const clean = prompt.trim();

    if (!clean || loading) {
      return;
    }

    await onSend(clean);
    setPrompt("");
  };

  return (
    <section className="panel">
      <div className="panel-title">
        <span>TEXT CHAT</span>
        <small>LLaMA</small>
      </div>

      <textarea
        value={prompt}
        onChange={(event) =>
          setPrompt(event.target.value)
        }
        onKeyDown={(event) => {
          if (
            event.key === "Enter" &&
            !event.shiftKey
          ) {
            event.preventDefault();
            void submit();
          }
        }}
        placeholder="Ask JARVIS..."
        rows={3}
        disabled={loading}
      />

      <button
        className="primary-button full-width"
        onClick={() => void submit()}
        disabled={loading || !prompt.trim()}
      >
        {loading ? "Thinking..." : "Send"}
      </button>
    </section>
  );
};

export default ChatPanel;

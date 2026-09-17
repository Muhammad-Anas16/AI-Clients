const ConversationPanel = ({
  partialText,
  commandText,
  answerText,
}) => (
  <section className="conversation">
    {partialText && (
      <div className="message-card">
        <span className="message-label">
          LISTENING
        </span>
        <p>{partialText}</p>
      </div>
    )}

    {commandText && (
      <div className="message-card">
        <span className="message-label">
          COMMAND
        </span>
        <p>{commandText}</p>
      </div>
    )}

    {answerText && (
      <div className="message-card answer-card">
        <span className="message-label">
          JARVIS
        </span>
        <p>{answerText}</p>
      </div>
    )}
  </section>
);

export default ConversationPanel;

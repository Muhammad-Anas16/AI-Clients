const VoiceControls = ({
  onStart,
  onStop,
  canStart,
  canStop,
}) => (
  <div className="button-row">
    <button
      className="primary-button"
      onClick={onStart}
      disabled={!canStart}
    >
      Start Listening
    </button>

    <button
      className="secondary-button"
      onClick={onStop}
      disabled={!canStop}
    >
      Stop
    </button>
  </div>
);

export default VoiceControls;

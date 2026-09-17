const ScreenPanel = ({
  onReadScreen,
  loading,
}) => (
  <section className="panel">
    <div className="panel-title">
      <span>SCREEN</span>
      <small>Tesseract + LLaMA</small>
    </div>

    <p className="panel-copy">
      Read the current PC screen using the
      server-side screenshot + OCR endpoint.
    </p>

    <button
      className="secondary-button full-width"
      onClick={onReadScreen}
      disabled={loading}
    >
      {loading
        ? "Reading Screen..."
        : "Read Screen"}
    </button>
  </section>
);

export default ScreenPanel;

const Header = ({ serverOnline }) => (
  <header className="app-header">
    <div>
      <div className="eyebrow">JARVIS</div>
      <h1>Local AI Assistant</h1>
      <p className="subtitle">
        Tauri desktop client
      </p>
    </div>

    <div
      className={`server-indicator ${
        serverOnline ? "online" : ""
      }`}
      title={
        serverOnline
          ? "Server online"
          : "Server offline"
      }
    />
  </header>
);

export default Header;

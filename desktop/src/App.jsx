import "./App.css";
import ServerStatus from "./components/ServerStatus";
import VoskStatus from "./components/VoskStatus";
import PiperStatus from "./components/PiperStatus";
import WebRTCAudioTest from "./components/audio/WebRTCAudioTest";

function App() {
  return (
    <main className="bg-amber-500">
      <ServerStatus />
      <VoskStatus />
      <PiperStatus />

      <h1>Hello world</h1>

      <WebRTCAudioTest />
    </main>
  );
}

export default App;

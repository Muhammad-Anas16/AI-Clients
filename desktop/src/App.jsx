import "./App.css";
import ServerStatus from "./components/status/ServerStatus";
import VoskStatus from "./components/status/VoskStatus";
import PiperStatus from "./components/status/PiperStatus";
import TalkToLlama from "./components/llama/TalkToLlama";
import PiperListening from "./components/piper/listening";

function App() {
  return (
    <main className="">
      <ServerStatus />
      <VoskStatus />
      <PiperStatus />
      {/* Llama */}
      <TalkToLlama />
      {/* Piper */}
      <PiperListening />
    </main>
  );
}

export default App;

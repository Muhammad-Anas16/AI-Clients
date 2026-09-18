import ServerStatus from "./components/ServerStatus";
import "./App.css";
import VoskStatus from "./components/VoskStatus";

function App() {
  return (
    <main className="bg-amber-500">
      <ServerStatus />
      <VoskStatus />

      <h1>Hello world</h1>
    </main>
  );
}

export default App;

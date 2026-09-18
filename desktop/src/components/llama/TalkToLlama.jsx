import { useState } from "react";
import { AskLlama, ListenPiper } from "../../services/api";

const TalkToLlama = () => {
  const [message, setMessage] = useState("");
  const [loading, setLoading] = useState(false);

  const handleSubmit = async (e) => {
    e.preventDefault();

    if (!message.trim()) return;

    try {
      setLoading(true);

      // Llama
      const llama = await AskLlama(message);
      const llamaRes = llama?.data?.answer || "Didn't Get Response";

      console.log("Llama:", llamaRes);

      // Piper
      const piper = await ListenPiper(llamaRes);

      console.log("Piper response:", piper);

      // WAV binary -> Blob
      const audioBlob = new Blob([piper], {
        type: "audio/wav",
      });

      // Blob -> URL
      const audioUrl = URL.createObjectURL(audioBlob);

      // Play audio
      const audio = new Audio(audioUrl);

      audio.onended = () => {
        URL.revokeObjectURL(audioUrl);
      };

      await audio.play();

      setMessage("");
    } catch (error) {
      console.error("Error:", error);
      alert("Something went wrong!");
    } finally {
      setLoading(false);
    }
  };

  return (
    <div className="flex items-center justify-center bg-gray-100 p-6">
      <form
        onSubmit={handleSubmit}
        className="w-full max-w-md rounded-2xl bg-white p-6 shadow-lg"
      >
        <h1 className="mb-4 text-2xl font-bold text-gray-900">Talk to Llama</h1>

        <div className="flex gap-3">
          <input
            type="text"
            value={message}
            onChange={(e) => setMessage(e.target.value)}
            placeholder="Type something..."
            disabled={loading}
            className="flex-1 rounded-xl border border-gray-300 px-4 py-3 outline-none transition focus:border-black focus:ring-2 focus:ring-gray-200 disabled:bg-gray-100"
          />

          <button
            type="submit"
            disabled={loading}
            className="rounded-xl bg-black px-5 py-3 font-medium text-white transition hover:bg-gray-800 active:scale-95 disabled:cursor-not-allowed disabled:opacity-50"
          >
            {loading ? "Loading..." : "Submit"}
          </button>
        </div>
      </form>
    </div>
  );
};

export default TalkToLlama;

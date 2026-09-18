import { useState } from "react";
import { AskLlama } from "../../services/api";

const TalkToLlama = () => {
  const [message, setMessage] = useState("");

  const handleSubmit = async (e) => {
    e.preventDefault();

    if (!message.trim()) return;

    const llama = await AskLlama(message);
    const llamaRes = llama?.data?.answer || "Didn't Get Response";
    console.log(llama);
    alert(llamaRes);
    setMessage("");
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
            className="flex-1 rounded-xl border border-gray-300 px-4 py-3 outline-none transition focus:border-black focus:ring-2 focus:ring-gray-200"
          />

          <button
            type="submit"
            className="rounded-xl bg-black px-5 py-3 font-medium text-white transition hover:bg-gray-800 active:scale-95"
          >
            Submit
          </button>
        </div>
      </form>
    </div>
  );
};

export default TalkToLlama;

import { useEffect, useState } from "react";
import { checkVoskStatus } from "../services/api";

const VoskStatus = () => {
  const [status, setStatus] = useState(null);
  const [error, setError] = useState("");

  useEffect(() => {
    const testServer = async () => {
      try {
        const data = await checkVoskStatus();
        setStatus(data);
        setError("");
      } catch (error) {
        setStatus(null);
        setError(error.message || "Internal Server Error");
      }
    };

    testServer();
  }, []);

  return (
    <div className="flex gap-2">
      Vosk Status :{" "}
      {status ? (
        <p>Vosk is Working</p>
      ) : error ? (
        <p>{error}</p>
      ) : (
        <p>Checking Vosk...</p>
      )}
    </div>
  );
};

export default VoskStatus;

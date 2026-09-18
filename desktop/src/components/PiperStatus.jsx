import { useEffect, useState } from "react";
import { checkPiperStatus } from "../services/api";

const PiperStatus = () => {
  const [status, setStatus] = useState(null);
  const [error, setError] = useState("");

  useEffect(() => {
    const testServer = async () => {
      try {
        const data = await checkPiperStatus();
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
      Piper Status :{" "}
      {status ? (
        <p>Piper Connected</p>
      ) : error ? (
        <p>{error}</p>
      ) : (
        <p>Checking Piper...</p>
      )}
    </div>
  );
};

export default PiperStatus;

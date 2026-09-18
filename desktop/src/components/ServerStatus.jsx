import { useEffect, useState } from "react";
import { checkStatus } from "../services/api";

function ServerStatus() {
  const [status, setStatus] = useState(null);
  const [error, setError] = useState("");

  useEffect(() => {
    const testServer = async () => {
      try {
        const data = await checkStatus();
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
      Server Status :  {status ? (
        <p>Server is Alive</p>
      ) : error ? (
        <p>{error}</p>
      ) : (
        <p>Checking server...</p>
      )}
    </div>
  );
}

export default ServerStatus;

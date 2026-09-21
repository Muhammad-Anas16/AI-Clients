// import { getServerURL } from "../utils/ipStorage";

// export const getIp = async () => {
//   try {
//     const url = await getServerURL();

//     if (!url) {
//       return null;
//     }

//     return `${url}/api/`;
//   } catch (error) {
//     console.error("Get API URL error:", error);
//     return null;
//   }
// };

// import axios from "axios";
// import { getServerURL } from "../utils/ipStorage";

// // API BASE URL
// export const getIp = async () => {
//   try {
//     const url = await getServerURL();

//     if (!url) {
//       return null;
//     }

//     // Extra trailing slash remove
//     return `${url.replace(/\/+$/, "")}/api`;
//   } catch (error) {
//     console.error("Get API URL error:", error);
//     return null;
//   }
// };

// // AXIOS CLIENT
// export const getHttp = async () => {
//   const baseURL = await getIp();

//   if (!baseURL) {
//     throw new Error("Server URL is not configured");
//   }

//   return axios.create({
//     baseURL,
//     timeout: 120000,
//   });
// };

// // SERVER STATUS
// export const checkServerStatus = async () => {
//   try {
//     const http = await getHttp();
//     const result = await http.get("status");

//     return result.data;
//   } catch (error) {
//     console.error("Server Status Error:", error);
//     throw error;
//   }
// };

// // VOSK STATUS
// export const checkVoskStatus = async () => {
//   try {
//     const http = await getHttp();
//     const result = await http.get("vosk/status");

//     return result.data;
//   } catch (error) {
//     console.error("Vosk Status Error:", error);
//     throw error;
//   }
// };

// // PIPER STATUS
// export const checkPiperStatus = async () => {
//   try {
//     const http = await getHttp();
//     const result = await http.get("piper/status");

//     return result.data;
//   } catch (error) {
//     console.error("Piper Status Error:", error);
//     throw error;
//   }
// };

// // VOSK TRANSCRIPTION
// export const transcribeAudio = async (wavBlob) => {
//   if (!(wavBlob instanceof Blob)) {
//     throw new Error("Audio data is not a valid Blob.");
//   }

//   try {
//     const http = await getHttp();
//     const formData = new FormData();
//     formData.append("audio", wavBlob, "recording.wav");
//     const result = await http.post("vosk/transcribe", formData, {
//       timeout: 120000,
//     });

//     return result.data;
//   } catch (error) {
//     console.error("Vosk Transcribe Error:", error);

//     if (error.response) {
//       console.error("Server Response:", error.response.data);
//     }

//     throw error;
//   }
// };

import axios from "axios";
import { getServerURL } from "../utils/ipStorage";

// GET API URL
export const getIp = async () => {
  try {
    const url = await getServerURL();

    if (!url) {
      return null;
    }

    return `${url.replace(/\/+$/, "")}/api`;
  } catch (error) {
    console.log("Server URL not available");
    return null;
  }
};

// GET HTTP CLIENT
export const getHttp = async () => {
  const baseURL = await getIp();

  if (!baseURL) {
    return null;
  }

  return axios.create({
    baseURL,
    timeout: 120000,
  });
};

// SERVER STATUS
export const checkServerStatus = async () => {
  try {
    const http = await getHttp();

    if (!http) {
      return {
        success: false,
        message: "Server is not connected",
      };
    }

    const result = await http.get("status");

    return result.data;
  } catch (error) {
    return {
      success: false,
      message: "Server is not connected",
    };
  }
};

// VOSK STATUS
export const checkVoskStatus = async () => {
  try {
    const http = await getHttp();

    if (!http) {
      return {
        success: false,
        message: "Server is not connected",
      };
    }

    const result = await http.get("vosk/status");

    return result.data;
  } catch (error) {
    return {
      success: false,
      message: "Vosk is not connected",
    };
  }
};

// PIPER STATUS
export const checkPiperStatus = async () => {
  try {
    const http = await getHttp();

    if (!http) {
      return {
        success: false,
        message: "Server is not connected",
      };
    }

    const result = await http.get("piper/status");

    return result.data;
  } catch (error) {
    return {
      success: false,
      message: "Piper is not connected",
    };
  }
};

// LLAMA
export const AskLlama = async (prompt) => {
  try {
    const http = await getHttp();

    if (!http) {
      return {
        success: false,
        message: "Server is not connected",
      };
    }

    const result = await http.post("llama/chat", {
      prompt,
    });

    return result.data;
  } catch (error) {
    return {
      success: false,
      message: "Llama is not available",
    };
  }
};

// PIPER TEXT TO SPEECH
export const ListenPiper = async (text) => {
  try {
    const http = await getHttp();

    if (!http) {
      return {
        success: false,
        message: "Server is not connected",
      };
    }

    const result = await http.post(
      "piper/synthesize",
      {
        text,
      },
      {
        responseType: "arraybuffer",
      },
    );

    return result.data;
  } catch (error) {
    return {
      success: false,
      message: "Piper is not available",
    };
  }
};

// VOSK TRANSCRIPTION
export const transcribeAudio = async (wavBlob) => {
  if (!(wavBlob instanceof Blob)) {
    return {
      success: false,
      message: "Invalid audio data",
    };
  }

  try {
    const http = await getHttp();

    if (!http) {
      return {
        success: false,
        message: "Server is not connected",
      };
    }

    const formData = new FormData();
    formData.append("audio", wavBlob, "recording.wav");
    const result = await http.post("vosk/transcribe", formData, {
      timeout: 120000,
    });

    return result.data;
  } catch (error) {
    return {
      success: false,
      message: "Vosk transcription failed",
    };
  }
};

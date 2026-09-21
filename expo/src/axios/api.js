// import axios from "axios";
// import { getServerURL } from "../utils/ipStorage";

// // GET API URL
// export const getIp = async () => {
//   try {
//     const url = await getServerURL();

//     if (!url) {
//       return null;
//     }

//     return `${url.replace(/\/+$/, "")}/api`;
//   } catch (error) {
//     console.log("Server URL not available");
//     return null;
//   }
// };

// // GET HTTP CLIENT
// export const getHttp = async () => {
//   const baseURL = await getIp();

//   if (!baseURL) {
//     return null;
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

//     if (!http) {
//       return {
//         success: false,
//         message: "Server is not connected",
//       };
//     }

//     const result = await http.get("status");

//     return result.data;
//   } catch (error) {
//     return {
//       success: false,
//       message: "Server is not connected",
//     };
//   }
// };

// // VOSK STATUS
// export const checkVoskStatus = async () => {
//   try {
//     const http = await getHttp();

//     if (!http) {
//       return {
//         success: false,
//         message: "Server is not connected",
//       };
//     }

//     const result = await http.get("vosk/status");

//     return result.data;
//   } catch (error) {
//     return {
//       success: false,
//       message: "Vosk is not connected",
//     };
//   }
// };

// // PIPER STATUS
// export const checkPiperStatus = async () => {
//   try {
//     const http = await getHttp();

//     if (!http) {
//       return {
//         success: false,
//         message: "Server is not connected",
//       };
//     }

//     const result = await http.get("piper/status");

//     return result.data;
//   } catch (error) {
//     return {
//       success: false,
//       message: "Piper is not connected",
//     };
//   }
// };

// // LLAMA
// export const AskLlama = async (prompt) => {
//   try {
//     const http = await getHttp();

//     if (!http) {
//       return {
//         success: false,
//         message: "Server is not connected",
//       };
//     }

//     const result = await http.post("llama/chat", {
//       prompt,
//     });

//     return result.data;
//   } catch (error) {
//     return {
//       success: false,
//       message: "Llama is not available",
//     };
//   }
// };

// // PIPER TEXT TO SPEECH
// export const ListenPiper = async (text) => {
//   try {
//     const http = await getHttp();

//     if (!http) {
//       return {
//         success: false,
//         message: "Server is not connected",
//       };
//     }

//     const result = await http.post(
//       "piper/synthesize",
//       {
//         text,
//       },
//       {
//         responseType: "arraybuffer",
//       },
//     );

//     return result.data;
//   } catch (error) {
//     return {
//       success: false,
//       message: "Piper is not available",
//     };
//   }
// };

// // VOSK TRANSCRIPTION
// export const transcribeAudio = async (wavBlob) => {
//   // if (!(wavBlob instanceof Blob)) {
//   //   return {
//   //     success: false,
//   //     message: "Invalid audio data",
//   //   };
//   // }

//   try {
//     const http = await getHttp();

//     if (!http) {
//       return {
//         success: false,
//         message: "Server is not connected",
//       };
//     }

//     const formData = new FormData();
//     formData.append("audio", wavBlob, "recording.wav");
//     const result = await http.post("vosk/transcribe", formData, {
//       timeout: 120000,
//     });

//     return result.data;
//   } catch (error) {
//     return {
//       success: false,
//       message: "Vosk transcription failed",
//     };
//   }
// };

import axios from "axios";
import { fetch as expoFetch } from "expo/fetch";
import { File } from "expo-file-system";

import { getServerURL } from "../utils/ipStorage";

// ==========================================
// GET API URL
// ==========================================

export const getIp = async () => {
  try {
    const url = await getServerURL();

    if (!url) {
      return null;
    }

    return `${url.replace(/\/+$/, "")}/api`;
  } catch (error) {
    console.log("Server URL not available:", error?.message);
    return null;
  }
};

// ==========================================
// GET HTTP CLIENT
// ==========================================

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

// ==========================================
// SERVER STATUS
// ==========================================

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
    console.log("Server status error:", error?.message);

    return {
      success: false,
      message: "Server is not connected",
    };
  }
};

// ==========================================
// VOSK STATUS
// ==========================================

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
    console.log("Vosk status error:", error?.message);

    return {
      success: false,
      message: "Vosk is not connected",
    };
  }
};

// ==========================================
// PIPER STATUS
// ==========================================

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
    console.log("Piper status error:", error?.message);

    return {
      success: false,
      message: "Piper is not connected",
    };
  }
};

// ==========================================
// LLAMA
// ==========================================

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
    console.log("Llama error:", error?.message);

    return {
      success: false,
      message: "Llama is not available",
    };
  }
};

// ==========================================
// PIPER TEXT TO SPEECH
// ==========================================

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
    console.log("Piper error:", error?.message);

    return {
      success: false,
      message: "Piper is not available",
    };
  }
};

// VOSK TRANSCRIPTION
export const transcribeAudio = async (wavUri) => {
  try {
    const baseURL = await getIp();

    if (!baseURL) {
      return {
        success: false,
        message: "Server is not connected",
      };
    }

    if (!wavUri) {
      return {
        success: false,
        message: "WAV file URI is missing",
      };
    }

    // Local Expo file
    const file = new File(wavUri);

    if (!file.exists) {
      return {
        success: false,
        message: "WAV file does not exist",
      };
    }


    // ======================================
    // MULTIPART FORM DATA
    // ======================================

    const formData = new FormData();

    formData.append("audio", file);

    // ======================================
    // SEND TO SERVER
    // ======================================

    const response = await expoFetch(`${baseURL}/vosk/transcribe`, {
      method: "POST",
      body: formData,
    });

    const responseText = await response.text();

    let data;

    try {
      data = JSON.parse(responseText);
    } catch {
      data = {
        success: false,
        message: responseText || "Invalid server response",
      };
    }

    if (!response.ok) {
      return {
        success: false,
        message: data?.message || "Vosk transcription failed",
        data: data?.data || null,
      };
    }

    return data;
  } catch (error) {
    console.error("Vosk upload error:", error);

    return {
      success: false,
      message: error?.message || "Vosk transcription failed",
    };
  }
};

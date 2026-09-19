// import { getServerURL } from "../utils/ipStorage";

// // Get complete server URL
// export const getIp = async () => {
//   try {
//     const url = await getServerURL();
//     const result = `${url}/api/`
//     return result;
//   } catch (error) {
//     return null;
//   }
// };

import { getServerURL } from "../utils/ipStorage";

export const getIp = async () => {
  try {
    const url = await getServerURL();

    if (!url) {
      return null;
    }

    return `${url}/api/`;
  } catch (error) {
    console.error("Get API URL error:", error);
    return null;
  }
};

import { getServerURL } from "../utils/ipStorage";

// Get complete server URL
export const getIp = async () => {
  try {
    const url = await getServerURL();
    const result = `${url}/api`
    return result;
  } catch (error) {
    return null;
  }
};

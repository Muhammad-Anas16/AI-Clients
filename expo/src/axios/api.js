export const getIp = async () => {
  const res = await getServerIP();
  console.log("User IP =>", res);
};

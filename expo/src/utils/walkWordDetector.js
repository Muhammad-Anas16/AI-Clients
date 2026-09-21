const WalkWordDetector = (result) => {
  const text = result?.data?.text?.toLowerCase() || "";

  const words = text
    .replace(/[.,!?;:]/g, "")
    .split(/\s+/)
    .filter(Boolean);

  return words.includes("friday") ? "friday" : null;
};

export default WalkWordDetector;

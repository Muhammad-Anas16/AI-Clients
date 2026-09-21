const normalizeText = (value) => {
  return String(value || "")
    .toLowerCase()
    .replace(/[^a-z0-9\s]/g, " ")
    .replace(/\s+/g, " ")
    .trim();
};

const escapeRegExp = (value) => {
  return String(value).replace(/[.*+?^${}()|[\]\\]/g, "\\$&");
};

const WalkWordDetector = (result, configuredWakeWord = "buddy") => {
  const text = result?.data?.text || result?.text || result?.transcript || "";

  const cleanText = normalizeText(text);

  const wakeWord = normalizeText(configuredWakeWord);

  if (!cleanText || !wakeWord) {
    return null;
  }

  const pattern = new RegExp(`(^|\\s)${escapeRegExp(wakeWord)}(?=\\s|$)`, "i");

  return pattern.test(cleanText) ? wakeWord : null;
};

export default WalkWordDetector;

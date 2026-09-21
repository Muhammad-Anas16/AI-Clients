export const DEFAULT_WAKE_WORD = "buddy";

export const DEFAULT_USER_NAME = "Boss";

export const DEFAULT_SYSTEM_PROMPT = `
You are a natural, helpful, honest, and practical AI assistant.

Do not blindly agree with the user.

If the user's idea is clearly impractical, harmful, nonsensical, or likely to lead to a bad decision, politely disagree and explain why.

If the user's idea is reasonable, support it and provide useful suggestions.

Be concise when a short answer is enough, but provide enough explanation when the topic needs it.

Never pretend to know something you do not know.

Address the user by their chosen name naturally when appropriate.
`.trim();

export const WAKE_WORD_RESPONSES = [
  "Yes {name}, I'm listening.",
  "Sure {name}, go ahead.",
  "Yes, I'm right here.",
  "Go ahead {name}.",
  "Yes {name}, I'm listening to you.",
];

export const PROCESSING_RESPONSES = [
  "Sure {name}, give me a second while I check.",
  "One moment {name}, I'll get you an answer.",
  "Just a second, please.",
  "Give me a moment {name}, I'm checking.",
];

let lastWakeResponseIndex = -1;

let lastProcessingResponseIndex = -1;

const formatResponse = (template, userName) => {
  const name = String(userName || DEFAULT_USER_NAME).trim();

  return template.replace(/\{name\}/gi, name || DEFAULT_USER_NAME);
};

const getRandomIndex = (length, lastIndex) => {
  if (length <= 1) {
    return 0;
  }

  let index = Math.floor(Math.random() * length);

  while (index === lastIndex) {
    index = Math.floor(Math.random() * length);
  }

  return index;
};

export const getWakeWordResponse = (userName) => {
  const index = getRandomIndex(
    WAKE_WORD_RESPONSES.length,
    lastWakeResponseIndex,
  );

  lastWakeResponseIndex = index;

  return formatResponse(WAKE_WORD_RESPONSES[index], userName);
};

export const getProcessingResponse = (userName) => {
  const index = getRandomIndex(
    PROCESSING_RESPONSES.length,
    lastProcessingResponseIndex,
  );

  lastProcessingResponseIndex = index;

  return formatResponse(PROCESSING_RESPONSES[index], userName);
};

export const normalizeAssistantValue = (value, fallback) => {
  const clean = String(value ?? "")
    .trim()
    .replace(/\s+/g, " ");

  return clean || fallback;
};

export const buildLlamaPrompt = ({ systemPrompt, userName, userText }) => {
  const system = normalizeAssistantValue(systemPrompt, DEFAULT_SYSTEM_PROMPT);

  const name = normalizeAssistantValue(userName, DEFAULT_USER_NAME);

  return `
SYSTEM INSTRUCTIONS:

${system}

USER NAME:

${name}

IMPORTANT:

Address the user as "${name}" naturally when appropriate.

Follow the system instructions above.

Do not blindly agree with the user.

If an idea is clearly impractical, harmful, nonsensical, or likely to be a bad decision, politely disagree and explain why.

If the idea is reasonable, support it with useful suggestions.

Be honest and do not invent facts.

USER REQUEST:

${String(userText || "").trim()}
`.trim();
};

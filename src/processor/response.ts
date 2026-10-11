import type { Reply } from "./types.js";

export function readResponse(customId: string, status: number, text: string): Reply {
  let j: unknown = undefined;
  let parsed = true;
  try {
    j = JSON.parse(text);
  } catch {
    parsed = false;
  }
  const obj = parsed && j !== null && typeof j === "object" && !Array.isArray(j)
    ? j as Record<string, unknown>
    : {};

  const usageRec = typeof obj.usage === "object" && obj.usage !== null && !Array.isArray(obj.usage)
    ? obj.usage as Record<string, unknown>
    : {};
  const generationId = typeof obj.id === "string" ? obj.id : null;
  const provider = typeof obj.provider === "string" ? obj.provider : null;
  const inputTokens = typeof usageRec.prompt_tokens === "number" ? usageRec.prompt_tokens : 0;
  const outputTokens = typeof usageRec.completion_tokens === "number" ? usageRec.completion_tokens : 0;
  const cost = typeof usageRec.cost === "number" ? usageRec.cost : null;

  const errorRec = typeof obj.error === "object" && obj.error !== null && !Array.isArray(obj.error)
    ? obj.error as Record<string, unknown>
    : null;
  const msg = errorRec !== null && typeof errorRec.message === "string" ? errorRec.message : null;

  let textOut: string | null = null;
  let finishReason: string | null = null;
  let error: string | null = null;

  if (status < 200 || status > 299) {
    error = "http " + String(status) + ": " + (msg ?? text.slice(0, 200));
  } else if (!parsed || j === null || typeof j !== "object" || Array.isArray(j)) {
    error = "unreadable response: " + text.slice(0, 200);
  } else if (obj.error !== undefined && obj.error !== null) {
    error = "provider error: " +
      (msg ?? JSON.stringify(obj.error).slice(0, 200));
  } else if (!Array.isArray(obj.choices) || obj.choices.length === 0 ||
    typeof obj.choices[0] !== "object" || obj.choices[0] === null) {
    error = "provider error: no choices";
  } else {
    const choice = obj.choices[0] as Record<string, unknown>;
    const message = typeof choice.message === "object" && choice.message !== null &&
      !Array.isArray(choice.message)
      ? choice.message as Record<string, unknown>
      : {};
    textOut = typeof message.content === "string" ? message.content : null;
    finishReason = typeof choice.finish_reason === "string" ? choice.finish_reason : null;
  }

  return {
    answer: { customId, text: textOut, finishReason, error },
    usage: { customId, inputTokens, outputTokens, cost, provider, generationId }
  };
}

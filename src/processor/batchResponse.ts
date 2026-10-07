import { readResponse } from "./response.js";
import type { Reply } from "./types.js";

export type BatchState = "pending" | "done" | "failed" | "error";

export interface BatchRead {
  batchId: string | null;
  state: BatchState;
  status: string | null;
  error: string | null;
  replies: Reply[];
  cost?: number;
}

const FAILED_STATUSES = ["failed", "expired", "cancelled", "canceled", "cancelling"];

function errorRead(error: string): BatchRead {
  return { batchId: null, state: "error", status: null, error, replies: [] };
}

function itemReply(customId: string, error: string): Reply {
  return {
    answer: { customId, text: null, finishReason: null, error },
    usage: { customId, inputTokens: 0, outputTokens: 0, cost: null, provider: null, generationId: null }
  };
}

export function readBatch(status: number, text: string): BatchRead {
  let j: unknown = undefined;
  let parsed = true;
  try {
    j = JSON.parse(text);
  } catch {
    parsed = false;
  }

  if (status < 200 || status > 299) {
    const bodyError = parsed && j !== null && typeof j === "object" && !Array.isArray(j)
      ? (j as Record<string, unknown>).error
      : undefined;
    const message = bodyError !== undefined && bodyError !== null && typeof bodyError === "object" &&
      !Array.isArray(bodyError) && typeof (bodyError as Record<string, unknown>).message === "string"
      ? (bodyError as Record<string, unknown>).message as string
      : null;
    return errorRead("http " + String(status) + ": " + (message ?? text.slice(0, 200)));
  }

  if (!parsed || j === null || typeof j !== "object" || Array.isArray(j)) {
    return errorRead("unreadable response: " + text.slice(0, 200));
  }
  const obj = j as Record<string, unknown>;

  if (typeof obj.status !== "string") {
    const bodyError = obj.error;
    const message = bodyError !== undefined && bodyError !== null && typeof bodyError === "object" &&
      !Array.isArray(bodyError) && typeof (bodyError as Record<string, unknown>).message === "string"
      ? (bodyError as Record<string, unknown>).message as string
      : null;
    return errorRead("provider error: " + (message ?? "no batch status"));
  }

  const batchId = typeof obj.id === "string" ? obj.id : null;
  const statusWord = obj.status;
  const state: BatchState = statusWord === "completed" ? "done"
    : FAILED_STATUSES.includes(statusWord) ? "failed"
    : "pending";
  const batchError = obj.error !== undefined && obj.error !== null && typeof obj.error === "object" &&
    !Array.isArray(obj.error) && typeof (obj.error as Record<string, unknown>).message === "string"
    ? (obj.error as Record<string, unknown>).message as string
    : null;

  const usageRec = obj.usage;
  let cost: number | undefined = undefined;
  if (usageRec !== undefined && usageRec !== null && typeof usageRec === "object" && !Array.isArray(usageRec)) {
    const c = (usageRec as Record<string, unknown>).cost;
    if (typeof c === "number") cost = c;
  }

  const replies: Reply[] = [];
  if (Array.isArray(obj.results)) {
    for (const raw of obj.results) {
      if (raw === null || typeof raw !== "object" || Array.isArray(raw)) continue;
      const entry = raw as Record<string, unknown>;
      if (typeof entry.custom_id !== "string") continue;
      const customId = entry.custom_id;

      if (entry.error !== undefined && entry.error !== null) {
        const message = typeof entry.error === "object" && entry.error !== null && !Array.isArray(entry.error) &&
          typeof (entry.error as Record<string, unknown>).message === "string"
          ? (entry.error as Record<string, unknown>).message as string
          : JSON.stringify(entry.error).slice(0, 200);
        replies.push(itemReply(customId, "batch item error: " + message));
        continue;
      }

      const response = entry.response;
      if (response === null || typeof response !== "object" || Array.isArray(response)) {
        replies.push(itemReply(customId, "batch item error: no response"));
        continue;
      }
      const responseRec = response as Record<string, unknown>;
      const statusCode = typeof responseRec.status_code === "number" ? responseRec.status_code : 200;
      replies.push(readResponse(customId, statusCode, JSON.stringify(responseRec.body ?? null)));
    }
  }

  const out: BatchRead = { batchId, state, status: statusWord, error: batchError, replies };
  if (cost !== undefined) out.cost = cost;
  return out;
}

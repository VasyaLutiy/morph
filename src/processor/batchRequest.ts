import type { Request } from "../compiler/types.js";
import type { ProcessorConfig, ProviderReasoning } from "./types.js";

export interface BatchCall {
  url: string;
  headers: Record<string, string>;
  body: string;
}

export function batchUrl(baseUrl: string): string {
  const stripped = baseUrl.replace(/\/+$/, "");
  const withoutV1 = stripped.endsWith("/v1")
    ? stripped.slice(0, -"/v1".length) + "/beta"
    : stripped;
  return withoutV1 + "/batches";
}

interface BatchItemBody {
  max_tokens?: number;
  reasoning?: ProviderReasoning;
  messages: { role: string; content: string }[];
}

export function assembleBatch(
  requests: Request[],
  config: ProcessorConfig
): BatchCall {
  const headers: Record<string, string> = {};
  if (config.apiKey !== null) {
    headers.Authorization = "Bearer " + config.apiKey;
  }
  headers["Content-Type"] = "application/json";

  const items = requests.map((request) => {
    const reasoning = request.reasoning ?? config.reasoning;
    const body: BatchItemBody = {
      ...(request.maxTokens !== null ? { max_tokens: request.maxTokens } : {}),
      ...(reasoning !== null
        ? {
            reasoning:
              "maxTokens" in reasoning
                ? { max_tokens: reasoning.maxTokens }
                : { effort: reasoning.effort },
          }
        : {}),
      messages: request.messages.map((m) => ({ role: m.role, content: m.content })),
    };
    return { custom_id: request.customId, body };
  });

  const body = JSON.stringify({
    endpoint: "/v1/chat/completions",
    model: config.model,
    requests: items,
  });

  return { url: batchUrl(config.baseUrl), headers, body };
}

import type { Request } from "../compiler/types.js";
import type { ProcessorConfig, ProviderBody, ProviderRequest } from "./types.js";

export function assembleRequest(
  request: Request,
  config: ProcessorConfig
): ProviderRequest {
  const url = config.baseUrl.replace(/\/+$/, "") + "/chat/completions";
  const headers: Record<string, string> = {};
  if (config.apiKey !== null) {
    headers.Authorization = "Bearer " + config.apiKey;
  }
  headers["Content-Type"] = "application/json";

  const reasoning = request.reasoning ?? config.reasoning;

  const body: ProviderBody = {
    model: request.model ?? config.model,
    messages: request.messages.map((m) => ({ role: m.role, content: m.content })),
    ...(request.maxTokens !== null ? { max_tokens: request.maxTokens } : {}),
    ...(reasoning !== null
      ? {
          reasoning:
            "maxTokens" in reasoning
              ? { max_tokens: reasoning.maxTokens }
              : { effort: reasoning.effort },
        }
      : {}),
    ...(config.providerOrder !== null
      ? { provider: { order: [...config.providerOrder], allow_fallbacks: false } }
      : {}),
    usage: { include: true },
  };

  return { url, headers, body };
}

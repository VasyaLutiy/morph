import { setTimeout as delay } from "node:timers/promises";
import type { Request } from "../compiler/types.js";
import { assembleRequest } from "./assemble.js";
import { readResponse } from "./response.js";
import { stubAnswer } from "./stub.js";
import type {
  Answer,
  GenerationResult,
  HttpReply,
  ProcessorConfig,
  Reply,
  Transport,
  Usage
} from "./types.js";

export const BACKOFF_MS = 1000;

export function realTransport(timeoutMs: number): Transport {
  return {
    fetch: (url, init): Promise<HttpReply> =>
      fetch(url, { ...init, signal: AbortSignal.timeout(timeoutMs) }),
    sleep: (ms: number): Promise<void> => delay(ms)
  };
}

function zeroUsage(customId: string): Usage {
  return {
    customId,
    inputTokens: 0,
    outputTokens: 0,
    cost: null,
    provider: null,
    generationId: null
  };
}

function isRetryable(status: number): boolean {
  return status === 408 || status === 429 || status >= 500;
}

async function sendOne(
  request: Request,
  config: ProcessorConfig,
  transport: Transport
): Promise<Reply> {
  const p = assembleRequest(request, config);
  let last: Reply | null = null;
  for (let k = 0; k <= config.maxRetries; k++) {
    if (k > 0) {
      await transport.sleep(BACKOFF_MS * 2 ** (k - 1));
    }
    try {
      const reply = await transport.fetch(p.url, {
        method: "POST",
        headers: p.headers,
        body: JSON.stringify(p.body)
      });
      const text = await reply.text();
      const r = readResponse(request.customId, reply.status, text);
      if (!isRetryable(reply.status)) {
        return r;
      }
      last = r;
    } catch (e) {
      const message = e instanceof Error ? e.message : String(e);
      last = {
        answer: {
          customId: request.customId,
          text: null,
          finishReason: null,
          error: "transport: " + message
        },
        usage: zeroUsage(request.customId)
      };
    }
  }
  const final: Reply = last as Reply;
  if (config.maxRetries > 0 && final.answer.error !== null) {
    final.answer.error =
      final.answer.error +
      " (after " + String(config.maxRetries + 1) + " attempts)";
  }
  return final;
}

export async function sendGeneration(
  config: ProcessorConfig,
  requests: Request[],
  transport: Transport
): Promise<GenerationResult> {
  const answers: Answer[] = new Array<Answer>(requests.length);
  const usage: Usage[] = new Array<Usage>(requests.length);

  if (config.route === "batch") {
    for (let i = 0; i < requests.length; i++) {
      answers[i] = {
        customId: requests[i].customId,
        text: null,
        finishReason: null,
        error: "route batch is not available on the sync sender"
      };
      usage[i] = zeroUsage(requests[i].customId);
    }
    return { answers, usage };
  }

  if (config.type === "stub") {
    for (let i = 0; i < requests.length; i++) {
      const r = stubAnswer(requests[i], config);
      answers[i] = r.answer;
      usage[i] = r.usage;
    }
    return { answers, usage };
  }

  let next = 0;
  const workers = Math.min(config.concurrency, requests.length);
  const run = async (): Promise<void> => {
    for (;;) {
      const i = next;
      next += 1;
      if (i >= requests.length) {
        return;
      }
      const r = await sendOne(requests[i], config, transport);
      answers[i] = r.answer;
      usage[i] = r.usage;
    }
  };
  const running: Promise<void>[] = [];
  for (let w = 0; w < workers; w++) {
    running.push(run());
  }
  await Promise.all(running);
  return { answers, usage };
}

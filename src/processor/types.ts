import type { Effort, Fault, Reasoning } from "../cards/types.js";
import type { Message } from "../compiler/types.js";
export type ProcessorType = "openrouter" | "stub";
export type Route = "sync" | "batch";
export interface ProcessorConfig {
  id: string; type: ProcessorType; model: string; apiKey: string | null; baseUrl: string;
  route: Route; concurrency: number; providerOrder: string[] | null; reasoning: Reasoning | null;
  timeoutMs: number; maxRetries: number; answersDir: string | null;
}
export interface Registry { configs: ProcessorConfig[]; faults: Fault[] }
export type ProviderReasoning = { max_tokens: number } | { effort: Effort };
export interface ProviderBody {
  model: string; messages: Message[]; max_tokens?: number; reasoning?: ProviderReasoning;
  provider?: { order: string[]; allow_fallbacks: false }; usage: { include: true };
}
export interface ProviderRequest { url: string; headers: Record<string, string>; body: ProviderBody }
export interface Answer { customId: string; text: string | null; finishReason: string | null; error: string | null }
export interface Usage {
  customId: string; inputTokens: number; outputTokens: number;
  cost: number | null; provider: string | null; generationId: string | null;
}
export interface Reply { answer: Answer; usage: Usage }
export interface HttpReply { status: number; text(): Promise<string> }
export interface Transport {
  fetch(url: string, init: { method: string; headers: Record<string, string>; body: string }): Promise<HttpReply>;
  sleep(ms: number): Promise<void>;
}
export interface GenerationResult { answers: Answer[]; usage: Usage[] }

import type { Deck } from "../cards/types.js";
import type { Request } from "../compiler/types.js";
import type { ProcessorConfig, Transport, Usage } from "../processor/types.js";

export type CardStatus = "written" | "failed" | "skipped" | "budget-exceeded";
export interface Diffstat { files: number; insertions: number; deletions: number }
export interface CommitInfo { commit: string; diffstat: Diffstat }
export type CommitHook = (customId: string, targets: string[]) => CommitInfo | null;
export interface CardOutcome {
  customId: string;
  status: CardStatus;
  reason: string | null;
  attempts: number;
  winningVariant: string | null;
  acceptanceLog: string;
  earlierFailures: string[];
  commit: string | null;
  diffstat: Diffstat | null;
}
export interface UsageTotals { inputTokens: number; outputTokens: number; cost: number | null; requests: number }
export interface RequestUsage {
  customId: string; model: string; provider: string | null; generationId: string | null;
  inputTokens: number; outputTokens: number; cost: number | null;
  finishReason: string | null; error: string | null;
  batchId?: string;
}
export interface RunReport {
  runId: string; completedAt: number; branch: string; processor: string;
  generations: number; outcomes: CardOutcome[]; usageTotals: UsageTotals;
  requests?: RequestUsage[]; fault?: string;
}
export interface RunBudget { maxCards: number; maxRetryBatches: number; deadline: number }
export interface RunDeps {
  config: ProcessorConfig; transport: Transport; commit: CommitHook;
  now: () => number; env: Record<string, string>; acceptanceTimeoutMs?: number;
  onVariant?: (record: VariantRecord) => void;
}
export interface RunInput { root: string; runId: string; branch: string; deck: Deck; budget: RunBudget }
export interface RetryContext { acceptanceOutput: string; previousDiff: string | null }
export interface GenerationOutcome {
  outcomes: CardOutcome[]; usage: Usage[]; requests: RequestUsage[];
  retryContexts: Record<string, RetryContext>;
}
export interface RunResult { report: RunReport; outcomes: CardOutcome[] }
export type VariantVerdict = "accepted" | "rejected" | "corrupt" | "truncated" | "untried" | "stale";
export interface VariantRecord {
  request: Request; text: string | null; finishReason: string | null; error: string | null;
  verdict: VariantVerdict; stages: number; lastStage: string | null;
}

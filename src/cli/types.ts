import type { Deck, Hazard, SliceWeight } from "../cards/types.js";
import type { Transport } from "../processor/types.js";
import type { RunReport } from "../runloop/types.js";
import type { ArchiveResult } from "../git/types.js";
import type { Plan } from "../planner/types.js";

export type ExitCode = 0 | 1 | 2 | 3 | 4;
export type ErrorKind = "UsageError" | "NotYetError" | "DeckError" | "RefusalError" | "RuntimeError";
export interface ErrorDocument { error: { code: ExitCode; kind: ErrorKind; message: string } }
export interface CommandResult { code: ExitCode; document: unknown }
export interface DeckCheckArgs { name: "deck check"; root: string; pretty: boolean; deck: string; sliceCapBytes: number }
export interface RunArgs {
  name: "run"; root: string; pretty: boolean; deck: string; processor: string; runId: string | null;
  deadlineSeconds: number; maxCards: number | null; maxRetryBatches: number;
}
export interface PlanArgs {
  name: "plan"; root: string; pretty: boolean; spec: string; components: string[]; map: string | null;
  judge: boolean; out: string | null; checks?: string;
}
export interface SubmitArgs { name: "submit"; root: string; pretty: boolean; deck: string; processor: string }
export interface CollectArgs { name: "collect"; root: string; pretty: boolean; batch: string }
export interface PrimerArgs { name: "primer"; root: string; pretty: boolean; write: boolean }
export interface ScoutArgs {
  name: "scout"; root: string; pretty: boolean; processor: string; issue: string; seedFile: string | null; deadlineSeconds: number;
}
export interface FromScoutArgs { name: "plan --from-scout"; root: string; pretty: boolean; fromScout: string; out: string | null }
export type Command = DeckCheckArgs | RunArgs | PlanArgs | SubmitArgs | CollectArgs | PrimerArgs | ScoutArgs | FromScoutArgs;
export type ParseResult = { ok: true; command: Command } | { ok: false; error: ErrorDocument };
export type DeckFileResult = { ok: true; deck: Deck } | { ok: false; result: CommandResult };
export interface DeckCheckDocument {
  deck: string; cards: number; generations: string[][]; errors: number; warnings: number;
  hazards: Hazard[]; weights: SliceWeight[];
}
export interface RunDocument { runId: string; branch: string; base: string; report: RunReport; archive: ArchiveResult }
export interface PlanDocument extends Plan { out: string | null }
export interface CliDeps {
  env: Record<string, string>; now: () => number; cwd: string; transport: Transport | null;
  interrupted?: () => string | null;
}
export interface CliIo { stdout(text: string): void; stderr(text: string): void }

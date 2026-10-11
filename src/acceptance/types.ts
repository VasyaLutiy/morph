import type { ParsedAnswer } from "../compiler/types.js";
export interface SnapshotEntry { path: string; bytes: Uint8Array | null }   // null = absent
export interface TargetSnapshot { root: string; entries: SnapshotEntry[] }  // targets order
export interface RunOptions { env: Record<string, string>; timeoutMs?: number }
export interface AcceptanceResult { exit: number | null; log: string; timedOut: boolean }
export interface VariantAnswer { variant: string; answer: ParsedAnswer }
export interface VerifyInput {
  root: string;
  targets: string[];
  command: string;
  variants: VariantAnswer[];
  env: Record<string, string>;
  timeoutMs?: number;
}
export interface VariantResult { variant: string; exit: number | null; log: string; diff: string | null }
export interface VerifyOutcome { accepted: { variant: string } | null; results: VariantResult[] }

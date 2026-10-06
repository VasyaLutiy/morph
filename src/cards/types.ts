export type Intent = "generate" | "patch";
export type Effort = "low" | "medium" | "high";
export type Reasoning = { maxTokens: number } | { effort: Effort };
export interface Card {
  customId: string;            // matches ^[A-Za-z0-9._-]+$
  intent: Intent;
  targets: string[];           // non-empty, normalised, distinct
  contextSlice: string[];      // default [] = "instruction only"
  instruction: string;         // non-empty
  acceptance: string | null;   // default null
  model: string | null;        // default null
  maxTokens: number | null;    // default null
  reasoning: Reasoning | null; // default null
  variants: number;            // integer >= 1, default 1
  dependsOn: string[];         // default []
}
export interface Deck { cards: Card[]; externalDependsOn: string[] }
export interface Fault { key: string; message: string }
export type CardResult = { ok: true; card: Card } | { ok: false; faults: Fault[] };
export type DeckResult = { ok: true; deck: Deck } | { ok: false; faults: Fault[] };
export type HazardKind = "write-write" | "read-write" | "implicit-read" | "unordered-read" | "oversized-slice";
export type Severity = "error" | "warning";
export interface Repair { addDependsOn: { card: string; on: string } }
export interface Hazard {
  kind: HazardKind; severity: Severity; cards: string[]; path: string | null;
  repair: Repair | null; bytes?: number; cap?: number;   // bytes and cap only on oversized-slice
}
export interface SliceWeight { card: string; bytes: number; missing: string[] }
export interface Weighing { weights: SliceWeight[]; hazards: Hazard[] }

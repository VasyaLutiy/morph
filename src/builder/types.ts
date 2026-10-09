import type { Card } from "../cards/types.js";
import type { LanguageProfile } from "../language/types.js";

export interface JudgeFile { file: string; min: number; max: number; lits: string[]; drop: string[]; new: boolean }
export interface CheckCard { id: string; smoke: number | null; extra: string | null; files: JudgeFile[] | null }
export interface Checks {
  version: 1; phase: string; parts: string; frozen: string[]; fullExclude: string[]; ownGit: boolean;
  cards: CheckCard[];
}
export type ChecksResult = { ok: true; checks: Checks } | { ok: false; problems: string[] };
export interface CardContext {
  id: string; phase: string; targets: string[]; siblings: string[]; frozen: string[];
  fullExclude: string[]; ownGit: boolean; profile: LanguageProfile; guard: string; firstdiff: string;
  allowed?: string[]; vendor?: boolean;
}
export interface BuildTexts { guard: string; firstdiff: string; probes: Record<string, string> }
export interface BuildInput {
  cards: Card[]; checks: Checks; profile: LanguageProfile; texts: BuildTexts;
  uses?: Record<string, string[]>; vendor?: boolean; hide?: Record<string, string[]>;
  transaction?: boolean;
}
export type BuildResult = { ok: true; cards: Card[] } | { ok: false; errors: string[] };

import type { Deck } from "../cards/types.js";

export interface GitResult { code: number | null; stdout: string; stderr: string }
export interface Diffstat { files: number; insertions: number; deletions: number }
export interface CommitInfo { commit: string; diffstat: Diffstat }
export type BranchResult = { ok: true; branch: string; base: string } | { ok: false; error: string };
export type Trailer = [string, string];
export interface CardCommit { customId: string; targets: string[]; model: string; variant: string | null; acceptanceExit: number }
export type CardCommitter = (customId: string, targets: string[]) => CommitInfo | null;
export interface ArchivedReport { outcomes: { status: string }[] }
export interface ArchiveInput { runId: string; deck: Deck; report: ArchivedReport }
export type ArchiveResult = { ok: true; dir: string; commit: string | null } | { ok: false; error: string };

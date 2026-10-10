import type { AcceptDeps } from "./acceptCard.js";
import type { DebtResult } from "./cardBrief.js";
import type { Diffstat } from "../git/types.js";

export interface GroupOptions { deck: string; ids: string[]; model: string | null; fromRun: string | null; pick: string[]; commit: boolean }
export interface GroupCard {
  card: string; variant: string | null; model: string; exit: number | null; timedOut: boolean; green: boolean;
  log: string; commit: string | null; diffstat: Diffstat | null; reason: string | null;
}
export interface AcceptGroupDocument {
  deck: string; run: string | null; cards: GroupCard[]; outside: string[] | null; green: boolean;
  committed: number; restored: boolean; reason: string | null;
}
export function acceptGroup(root: string, args: GroupOptions, deps: AcceptDeps): Promise<DebtResult> {
  return Promise.reject(new Error("stub acceptGroup " + root + String(args.ids.length) + String(Object.keys(deps).length)));
}

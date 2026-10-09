import type { Card } from "../cards/types.js";
import type { Mutant } from "../reviewer/planMutants.js";
export const MUTANT_CAP = 30;
export const MUTANT_STOP_SECONDS = 1200;
export interface GateMutant { card: string; mutant: Mutant }
export interface GateMutantSpot { card: string; path: string; line: number; column: number; rule: string }
export interface GateBaseline { card: string; exit: number | null; timedOut: boolean }
export interface GateMutants { planned: number; tried: number; killed: number; timedOut: number; seconds: number;
  survivors: GateMutantSpot[]; untried: GateMutantSpot[]; baselines: GateBaseline[] }
export interface GateMutantDeps { env: Record<string, string>; now: () => number; timeoutMs?: number; stopSeconds?: number }
export function killCommand(acceptance: string): string {
  throw new Error("stub killCommand " + String(acceptance.length));
}
export function planGateMutants(cards: readonly Card[], read: (target: string) => string | null, cap: number): GateMutant[] {
  throw new Error("stub planGateMutants " + JSON.stringify([cards.length, typeof read, cap]));
}
export async function runGateMutants(root: string, cards: readonly Card[], planned: readonly GateMutant[], deps: GateMutantDeps): Promise<GateMutants> {
  throw new Error("stub runGateMutants " + JSON.stringify([root.length, cards.length, planned.length, typeof deps.now]));
}

import type { Card } from "../cards/types.js";
export type GatePhase = "stub" | "ref" | "retry";
export interface GateStep { phase: GatePhase; generation: number; card: string; put: Record<string, "stub" | "ref">; commit: string[] }
export interface GatePlan { transaction: boolean; steps: GateStep[]; missing: string[] }
export function gatePlan(cards: readonly Card[], generations: string[][], stubs: readonly string[], refs: readonly string[]): GatePlan {
  throw new Error("stub gatePlan " + JSON.stringify([cards.length, generations.length, stubs.length, refs.length]));
}

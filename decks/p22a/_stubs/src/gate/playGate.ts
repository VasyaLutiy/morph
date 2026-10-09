import type { Card } from "../cards/types.js";
import type { GatePhase, GateStep } from "./gatePlan.js";
export interface PlayRow { phase: GatePhase; generation: number; card: string; exit: number | null; timedOut: boolean; seconds: number;
  stage: string | null; expected: string | null; outside: string[]; failures: string[]; ok: boolean }
export interface PlayInput { root: string; cards: readonly Card[]; steps: readonly GateStep[]; stubDir: string; refDir: string }
export interface PlayDeps { env: Record<string, string>; now: () => number; timeoutMs?: number; before?: (scratch: string) => void }
export function playGate(input: PlayInput, deps: PlayDeps): Promise<PlayRow[]> {
  return Promise.reject(new Error("stub playGate " + JSON.stringify([input.cards.length, input.steps.length, deps.timeoutMs ?? null])));
}

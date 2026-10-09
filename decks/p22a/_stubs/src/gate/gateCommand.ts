import type { Deck } from "../cards/types.js";
import type { PlayRow } from "./playGate.js";
export const CHAIN_LIMIT_SECONDS = 0;
export interface GateBuild { card: string; generation: number; language: string | null; stubbed: number; missing: string[]; breaks: string[]; note: string | null }
export interface GateArgs { deck: string; stubs: string; refs: string }
export type GateDeckRead = { ok: true; deck: Deck } | { ok: false; result: { code: 0 | 1 | 2 | 3 | 4; document: unknown } };
export interface GateDeps { env: Record<string, string>; now: () => number; timeoutMs?: number;
  readDeck: (root: string, deckPath: string) => GateDeckRead;
  builds: (root: string, deckPath: string, deck: Deck, generations: string[][], env: Record<string, string>) => GateBuild[] | null }
export interface GateDocument { deck: string; transaction: boolean; cards: number; generations: string[][]; missing: string[];
  builds: GateBuild[] | null; rows: PlayRow[]; maxSeconds: number; errors: string[] }
export function gateCommand(root: string, args: GateArgs, deps: GateDeps): Promise<{ code: 0 | 1 | 2 | 3 | 4; document: unknown }> {
  return Promise.reject(new Error("stub gateCommand " + JSON.stringify([root.length, args.deck, Object.keys(deps.env).length])));
}

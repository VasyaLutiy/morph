import type { Card } from "../cards/types.js";

export interface SuiteResult {
  command: string;
  ok: boolean;
  failing: string[];
  cards: string[];
  log: string;
}

export const RELATED_MARK: string = "stub RELATED_MARK";
export const SUITE_LINE: string = "stub SUITE_LINE";
export const SUITE_SCRIPT: string = "stub SUITE_SCRIPT";

export function suiteNet(
  root: string,
  cards: readonly Card[],
  env: Record<string, string>,
  timeoutMs?: number
): Promise<SuiteResult | null> {
  throw new Error("stub suiteNet " + root + cards.length + Object.keys(env).length + String(timeoutMs));
}

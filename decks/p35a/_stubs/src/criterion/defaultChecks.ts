import type { Card } from "../cards/types.js";
import type { Checks } from "../builder/types.js";
import type { Example } from "../contour/types.js";
import type { LanguageProfile } from "../language/types.js";
import type { CardCriterion } from "../planner/types.js";
import type { ExampleCount } from "./probeNames.js";

export interface DefaultChecksInput {
  checks: Checks; cards: Card[]; all: string[]; criteria: Record<string, CardCriterion>; profile: LanguageProfile;
  mapAcceptance: string[]; hasFile: (path: string) => boolean; record: ExampleCount[];
  probes: Record<string, string>; readProbe: (id: string) => string | null;
}
export type DefaultChecksResult =
  | { ok: true; checks: Checks; probes: Record<string, string>; overrides: string[] }
  | { ok: false; message: string };

export function thenLiterals(examples: readonly Example[]): string[] {
  throw new Error("stub thenLiterals " + String(examples.length));
}

export function defaultChecks(input: DefaultChecksInput): DefaultChecksResult {
  throw new Error("stub defaultChecks " + input.checks.phase);
}

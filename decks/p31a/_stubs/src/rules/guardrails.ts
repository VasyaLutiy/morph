import type { ContourMap, ContourRecord } from "../contour/types.js";
import type { LanguageProfile } from "../language/types.js";

export type GuardrailRulesResult =
  | { ok: true; rules: Record<string, Record<string, string>>; proseOnly: string[] }
  | { ok: false; errors: string[] };

export type PlanRulesResult =
  | {
      ok: true;
      layers: Record<string, string[]> | null;
      rules: Record<string, Record<string, string>> | null;
      proseOnly: string[];
    }
  | { ok: false; error: string };

export function guardrailRules(record: ContourRecord, map: ContourMap): GuardrailRulesResult {
  throw new Error("stub guardrailRules " + record.system.name + " " + map.cards.length);
}

export function cardRules(
  profile: LanguageProfile,
  targets: readonly string[],
  rules: Record<string, Record<string, string>>,
): Record<string, Record<string, string>> {
  throw new Error("stub cardRules " + profile.id + " " + targets.length + " " + Object.keys(rules).length);
}

export function rulesArg(rules: Record<string, Record<string, string>> | undefined): string {
  throw new Error("stub rulesArg " + String(rules === undefined));
}

export function guardContract(guard: string): number {
  throw new Error("stub guardContract " + guard.length);
}

export function planRules(
  record: ContourRecord,
  map: ContourMap,
  layersFile: boolean,
  guard: string,
  language: string,
): PlanRulesResult {
  throw new Error("stub planRules " + record.system.name + " " + map.cards.length + " " + String(layersFile) + guard + language);
}

import { posix } from "node:path";
import { resolveProfile } from "../language/profiles.js";
import { cutTargets, slugName } from "../language/naming.js";
import { codeTargets } from "../language/paths.js";
import { guardrailKey, guardrailRule } from "../language/guardrails.js";
import { GUARD_CONTRACT, planLayers } from "./layers.js";
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

interface NamedPlace {
  name: string;
  place: string;
}

interface Unit {
  dirs: string[];
  names: NamedPlace[];
}

function codeDirs(profile: LanguageProfile, targets: readonly string[]): string[] {
  const out: string[] = [];
  const seen = new Set<string>();
  for (const target of codeTargets(profile, targets)) {
    const dir = posix.dirname(target);
    if (seen.has(dir)) continue;
    seen.add(dir);
    out.push(dir);
  }
  return out;
}

export function guardrailRules(record: ContourRecord, map: ContourMap): GuardrailRulesResult {
  const errors: string[] = [];
  const errorSet = new Set<string>();
  const addError = (text: string): void => {
    if (errorSet.has(text)) return;
    errorSet.add(text);
    errors.push(text);
  };

  const rules: Record<string, Record<string, string>> = {};
  const proseOnly: string[] = [];
  const proseKeys = new Set<string>();
  const addProse = (name: string): void => {
    const key = guardrailKey(name);
    if (proseKeys.has(key)) return;
    proseKeys.add(key);
    proseOnly.push(name);
  };

  for (const component of record.system.groups) {
    const profileResult = resolveProfile(component.language, map.language);
    if (!profileResult.ok) {
      addError("Component '" + component.name + "': " + profileResult.error);
      continue;
    }
    const profile = profileResult.profile;

    const units: Unit[] = [];

    for (const fn of component.functions) {
      const group = map.groups.find((g) => g.functions.includes(fn.name));
      const unitName = group === undefined ? fn.name : group.name;
      const card = map.cards.find((c) => c.id === slugName(unitName));
      let targets: readonly string[];
      if (card !== undefined && card.targets !== null) {
        targets = card.targets;
      } else {
        const cut = cutTargets(profile, component.name, unitName);
        if (!cut.ok) {
          addError("Component '" + component.name + "': " + cut.error);
          continue;
        }
        targets = [cut.targets.code, cut.targets.test];
      }
      const names: NamedPlace[] = [];
      for (const guardrail of fn.guardrails) {
        names.push({ name: guardrail, place: "Function " + fn.name });
      }
      for (const iface of component.interfaces) {
        if (iface.exposes.length !== 1 || iface.exposes[0] !== fn.name) continue;
        for (const guardrail of iface.guardrails ?? []) {
          names.push({ name: guardrail, place: "Interface " + iface.name });
        }
      }
      units.push({ dirs: codeDirs(profile, targets), names });
    }

    for (const iface of component.interfaces) {
      if (iface.exposes.length === 1) continue;
      const card = map.cards.find((c) => c.id === slugName(iface.name));
      let targets: readonly string[];
      if (card !== undefined && card.targets !== null) {
        targets = card.targets;
      } else {
        const cut = cutTargets(profile, component.name, iface.name);
        if (!cut.ok) {
          addError("Component '" + component.name + "': " + cut.error);
          continue;
        }
        targets = [cut.targets.code, cut.targets.test];
      }
      const names: NamedPlace[] = [];
      for (const guardrail of iface.guardrails ?? []) {
        names.push({ name: guardrail, place: "Interface " + iface.name });
      }
      units.push({ dirs: codeDirs(profile, targets), names });
    }

    for (const unit of units) {
      for (const dir of unit.dirs) {
        if (Object.hasOwn(rules, dir)) continue;
        rules[dir] = {};
      }
    }

    for (const unit of units) {
      const names: NamedPlace[] = [...unit.names];
      for (const guardrail of component.guardrails) {
        names.push({ name: guardrail, place: "Component " + component.name });
      }
      for (const guardrail of record.system.guardrails) {
        names.push({ name: guardrail, place: "System " + record.system.name });
      }
      for (const named of names) {
        const id = guardrailRule(profile, named.name);
        if (id === null) {
          addProse(named.name);
          continue;
        }
        const text = "Guardrail '" + named.name + "' of " + named.place;
        for (const dir of unit.dirs) {
          const entry: Record<string, string> | undefined = rules[dir];
          if (entry === undefined) continue;
          if (Object.hasOwn(entry, id)) continue;
          entry[id] = text;
        }
      }
    }
  }

  if (errors.length > 0) return { ok: false, errors };

  const sortedRules: Record<string, Record<string, string>> = {};
  for (const dir of Object.keys(rules).sort()) {
    const entry: Record<string, string> | undefined = rules[dir];
    if (entry === undefined) continue;
    const sortedEntry: Record<string, string> = {};
    for (const id of Object.keys(entry).sort()) {
      const text: string | undefined = entry[id];
      if (text === undefined) continue;
      sortedEntry[id] = text;
    }
    sortedRules[dir] = sortedEntry;
  }

  return { ok: true, rules: sortedRules, proseOnly };
}

export function cardRules(
  profile: LanguageProfile,
  targets: readonly string[],
  rules: Record<string, Record<string, string>>,
): Record<string, Record<string, string>> {
  const out: Record<string, Record<string, string>> = {};
  for (const target of codeTargets(profile, targets)) {
    const dir = posix.dirname(target);
    if (Object.hasOwn(out, dir)) continue;
    if (Object.hasOwn(rules, dir)) {
      const entry: Record<string, string> | undefined = rules[dir];
      out[dir] = entry === undefined ? {} : entry;
    } else {
      out[dir] = {};
    }
  }
  return out;
}

export function rulesArg(rules: Record<string, Record<string, string>> | undefined): string {
  if (rules === undefined) return "";
  return " '" + JSON.stringify(rules).replaceAll("'", "\\u0027") + "'";
}

export function guardContract(guard: string): number {
  const match = /morph-guard-contract: (\d+)/.exec(guard);
  if (match === null) return 0;
  const digits = match[1];
  if (digits === undefined) return 0;
  return Number(digits);
}

export function planRules(
  record: ContourRecord,
  map: ContourMap,
  layersFile: boolean,
  guard: string,
  language: string,
): PlanRulesResult {
  const contract = guardContract(guard);
  if (contract < 2 && !layersFile) {
    return { ok: true, layers: null, rules: null, proseOnly: [] };
  }

  const layersResult = planLayers(record, map, true, contract >= 2 ? GUARD_CONTRACT : guard, language);
  if (!layersResult.ok) {
    return { ok: false, error: layersResult.error };
  }

  const rulesResult = guardrailRules(record, map);
  if (!rulesResult.ok) {
    return { ok: false, error: rulesResult.errors.join("\n") };
  }

  if (contract >= 3) {
    return {
      ok: true,
      layers: layersResult.layers,
      rules: rulesResult.rules,
      proseOnly: rulesResult.proseOnly,
    };
  }

  let hasRule = false;
  for (const dir of Object.keys(rulesResult.rules)) {
    const entry: Record<string, string> | undefined = rulesResult.rules[dir];
    if (entry === undefined) continue;
    if (Object.keys(entry).length > 0) {
      hasRule = true;
      break;
    }
  }

  if (hasRule) {
    const shown = contract < 1 ? 1 : contract;
    return {
      ok: false,
      error:
        "decks/tools/guard.mjs speaks contract " +
        shown +
        ": copy templates/" +
        language +
        "/decks/tools/guard.mjs from MorphV2",
    };
  }

  return { ok: true, layers: layersResult.layers, rules: null, proseOnly: [] };
}

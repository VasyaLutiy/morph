import type { LanguageProfile, ProfileId } from "./types.js";

export const GUARDRAIL_RULES: Record<ProfileId, Record<string, string>> = {
  typescript: {
    "no shell": "no-shell",
    "no clock": "no-clock",
    "no network": "no-network",
    "no env": "no-env",
    "no process": "no-process",
    "stdlib only": "stdlib-only",
    "pure": "pure",
  },
  python: {},
  go: {
    "no shell": "no-shell",
    "no clock": "no-clock",
    "no network": "no-network",
    "no env": "no-env",
    "stdlib only": "stdlib-only",
    "pure": "pure",
  },
};

export function guardrailKey(name: string): string {
  return name.trim().toLowerCase().replace(/\s+/g, " ");
}

export function guardrailRule(profile: LanguageProfile, name: string): string | null {
  const key = guardrailKey(name);
  const table = GUARDRAIL_RULES[profile.id];
  if (!Object.hasOwn(table, key)) {
    return null;
  }
  return table[key] ?? null;
}

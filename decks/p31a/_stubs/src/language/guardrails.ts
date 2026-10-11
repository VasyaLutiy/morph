import type { LanguageProfile, ProfileId } from "./types.js";

export const GUARDRAIL_RULES: Record<ProfileId, Record<string, string>> = { typescript: {}, python: {}, go: {} };

export function guardrailKey(name: string): string {
  throw new Error("stub guardrailKey " + name);
}

export function guardrailRule(profile: LanguageProfile, name: string): string | null {
  throw new Error("stub guardrailRule " + profile.id + " " + name);
}

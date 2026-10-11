import type { LanguageProfile } from "../language/types.js";

export interface ExampleCount { name: string; count: number }
export interface ProbeTitle { function: string; n: number }
export interface ProbeNamesInput {
  id: string; path: string; profile: LanguageProfile; text: string; own: ExampleCount[]; record: ExampleCount[]; strict: boolean;
}

export function pascalName(name: string): string {
  throw new Error("stub pascalName " + name);
}

export function probeTitles(profile: LanguageProfile, text: string, names: readonly string[]): ProbeTitle[] {
  throw new Error("stub probeTitles " + profile.id + " " + String(text.length) + " " + String(names.length));
}

export function checkProbeNames(input: ProbeNamesInput): string[] {
  throw new Error("stub checkProbeNames " + input.id);
}

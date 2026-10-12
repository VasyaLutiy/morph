import type { LanguageProfile } from "../language/types.js";

export function recordSection(
  root: string,
  files: readonly string[],
  profile: LanguageProfile,
  owned: readonly string[],
): string {
  throw new Error("stub recordSection " + root + files.length + profile.id + owned.length);
}

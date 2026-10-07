import { posix } from "node:path";
import { PROFILES } from "./profiles.js";
import type { LanguageProfile } from "./types.js";

export function normalizePath(path: string): string {
  let normalized = path.split("\\").join("/");
  while (normalized.startsWith("./")) {
    normalized = normalized.slice(2);
  }
  return normalized;
}

function extOf(path: string): string {
  return posix.extname(normalizePath(path)).toLowerCase();
}

export function hasExtension(profile: LanguageProfile, path: string): boolean {
  return profile.extensions.includes(extOf(path));
}

export function isTest(profile: LanguageProfile, path: string): boolean {
  const parts = normalizePath(path).split("/");
  const base = parts[parts.length - 1];
  for (let i = 0; i < parts.length - 1; i++) {
    if (profile.testDirs.includes(parts[i])) {
      return true;
    }
  }
  return new RegExp(profile.testFilePattern).test(base);
}

export function codeTargets(profile: LanguageProfile, targets: readonly string[]): string[] {
  return targets.filter((t) => hasExtension(profile, t) && !isTest(profile, t));
}

export function testTarget(profile: LanguageProfile, targets: readonly string[]): string | null {
  for (const t of targets) {
    if (hasExtension(profile, t) && isTest(profile, t)) {
      return t;
    }
  }
  return null;
}

export function profileForPath(path: string): LanguageProfile | null {
  const ext = extOf(path);
  for (const profile of PROFILES) {
    if (profile.extensions.includes(ext)) {
      return profile;
    }
  }
  return null;
}

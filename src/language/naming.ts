import { fillTemplate } from "./profiles.js";
import type { LanguageProfile, NameCase, TargetsResult } from "./types.js";

export function nameWords(name: string): string[] {
  return name
    .toLowerCase()
    .split(/[^a-z0-9]+/)
    .filter((w) => w !== "");
}

export function slugName(name: string): string {
  return nameWords(name).join("-");
}

export function caseName(name: string, nameCase: NameCase): string {
  const words = nameWords(name);
  if (nameCase === "snake") {
    return words.join("_");
  }
  return words
    .map((w, i) => (i === 0 ? w : w.charAt(0).toUpperCase() + w.slice(1)))
    .join("");
}

export function cutTargets(profile: LanguageProfile, component: string, functionName: string): TargetsResult {
  if (nameWords(component).length === 0) {
    return { ok: false, error: "no letters or digits in name '" + component + "'" };
  }
  if (nameWords(functionName).length === 0) {
    return { ok: false, error: "no letters or digits in name '" + functionName + "'" };
  }
  const values = {
    component: caseName(component, profile.nameCase),
    name: caseName(functionName, profile.nameCase),
  };
  return {
    ok: true,
    slug: slugName(functionName),
    targets: {
      code: fillTemplate(profile.codeTarget, values),
      test: fillTemplate(profile.testTarget, values),
      judge: fillTemplate(profile.judgeTarget, values),
    },
  };
}

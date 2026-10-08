import type { LanguageProfile } from "./types.js";

export interface FinaleDependency {
  name: string;
  version: string;
  doc: string | null;
}

export interface StdlibClause {
  clause: string;
  replacement: string;
}

export const STDLIB_CLAUSES: Readonly<Record<string, StdlibClause>> = {
  python: {
    clause: "standard library only, ",
    replacement: "",
  },
  go: {
    clause: "the standard library only (go.mod requires nothing; the build runs with GOPROXY=off)",
    replacement: "the standard library and the modules named at the end (go.mod requires them; the build runs with GOPROXY=off)",
  },
};

export function dependencyDirective(deps: readonly FinaleDependency[]): string {
  const modules = deps.map((dep) => dep.name + "@" + dep.version).join(", ");
  const docs: string[] = [];
  for (const dep of deps) {
    if (dep.doc !== null && !docs.includes(dep.doc)) {
      docs.push(dep.doc);
    }
  }
  const api = docs.length > 0 ? "; their API is in " + docs.join(", ") : "";
  return "the standard library plus " + modules + api + "; no other import";
}

export function dependencyFinale(profile: LanguageProfile, deps: readonly FinaleDependency[]): string {
  if (deps.length === 0) {
    return profile.finale;
  }
  const rule = STDLIB_CLAUSES[profile.id];
  let finale = profile.finale;
  if (rule !== undefined) {
    const at = finale.indexOf(rule.clause);
    if (at !== -1) {
      finale = finale.slice(0, at) + rule.replacement + finale.slice(at + rule.clause.length);
    }
  }
  return finale + " Imports: " + dependencyDirective(deps) + ".";
}

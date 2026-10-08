// P19a probe for dependency-finale by docs/TASK_P19a_deps.md §2.2 (src/language/dependencyFinale.ts) — a code card's
// finale from its profile and its Component's dependencies; with none, the profile's finale byte for byte (issue #10).
// Record Dependency Finale examples 1-4, then rows.
import { test, expect } from "vitest";
import { STDLIB_CLAUSES, dependencyDirective, dependencyFinale } from "../../src/language/dependencyFinale.js";
import type { FinaleDependency, StdlibClause } from "../../src/language/dependencyFinale.js";
import { GO, PYTHON, TYPESCRIPT } from "../../src/language/profiles.js";
import type { LanguageProfile } from "../../src/language/types.js";
import { fixture } from "../../tests/helpers.js";

test("Dependency Finale example 1: no dependency, the profile's finale itself", () => {
  for (const p of [TYPESCRIPT, PYTHON, GO]) expect([p.id, dependencyFinale(p, [])]).toStrictEqual([p.id, p.finale]);
});

test("Dependency Finale example 2: typescript, three in the given order, one doc listed once", () => {
  const deps: FinaleDependency[] = [{ name: "zod", version: "3.23.8", doc: null }, { name: "ajv", version: "8.17.1", doc: "docs/deps/ajv.md" },
    { name: "ajv-formats", version: "3.0.1", doc: "docs/deps/ajv.md" }];
  expect(dependencyFinale(TYPESCRIPT, deps)).toBe(TYPESCRIPT.finale +
    " Imports: the standard library plus zod@3.23.8, ajv@8.17.1, ajv-formats@3.0.1; their API is in docs/deps/ajv.md; no other import.");
});

test("Dependency Finale example 3: go, the clause replaced, the whole text", () => {
  const got = dependencyFinale(GO, [{ name: "github.com/google/go-cmp", version: "v0.7.0", doc: "docs/deps/go-cmp.md" },
    { name: "golang.org/x/text", version: "v0.21.0", doc: null }]);
  expect(got).toBe(fixture("language/finale.go.txt"));
  expect(got.includes("requires nothing")).toBe(false);
});

test("Dependency Finale example 4: python without a doc; the directive alone", () => {
  expect(dependencyFinale(PYTHON, [{ name: "pyyaml", version: "6.0.2", doc: null }])).toBe(
    "Python 3.10 or later, type hints on every public function. Tests are pytest: plain `assert` on scalars and short values; fixtures and stubs come from `tests/conftest.py`, never your own. Imports: the standard library plus pyyaml@6.0.2; no other import.");
  expect(dependencyDirective([{ name: "a", version: "1", doc: "d/a.md" }])).toBe("the standard library plus a@1; their API is in d/a.md; no other import");
});

test("row: the clause table; a finale without the clause only gains the sentence; docs distinct in first place", () => {
  const table: Record<string, StdlibClause> = { ...STDLIB_CLAUSES };
  expect(table).toStrictEqual({
    python: { clause: "standard library only, ", replacement: "" },
    go: { clause: "the standard library only (go.mod requires nothing; the build runs with GOPROXY=off)",
      replacement: "the standard library and the modules named at the end (go.mod requires them; the build runs with GOPROXY=off)" } });
  const bare: LanguageProfile = { ...GO, finale: "Go, $& and $1." };
  expect(dependencyFinale(bare, [{ name: "m", version: "v1.0.0", doc: null }])).toBe("Go, $& and $1. Imports: the standard library plus m@v1.0.0; no other import.");
  const twice: LanguageProfile = { ...PYTHON, finale: "A standard library only, B standard library only, C" };
  expect(dependencyFinale(twice, [{ name: "q", version: "2", doc: "y.md" }, { name: "r", version: "3", doc: "x.md" }, { name: "s", version: "4", doc: "y.md" }]))
    .toBe("A B standard library only, C Imports: the standard library plus q@2, r@3, s@4; their API is in y.md, x.md; no other import.");
});

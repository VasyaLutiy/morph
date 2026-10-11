import { expect, test } from "vitest";
import { dependencyDirective, dependencyFinale } from "../../src/language/dependencyFinale.js";
import { GO, PYTHON, TYPESCRIPT } from "../../src/language/profiles.js";
import { fixture } from "../helpers.js";

test("Dependency Finale example 1: no dependencies is the profile's own finale", () => {
  expect(dependencyFinale(TYPESCRIPT, [])).toBe(TYPESCRIPT.finale);
  expect(dependencyFinale(PYTHON, [])).toBe(PYTHON.finale);
  expect(dependencyFinale(GO, [])).toBe(GO.finale);
});

test("Dependency Finale example 2: typescript names the modules and their one doc in given order", () => {
  const deps = [
    { name: "zod", version: "3.23.8", doc: null },
    { name: "ajv", version: "8.17.1", doc: "docs/deps/ajv.md" },
    { name: "ajv-formats", version: "3.0.1", doc: "docs/deps/ajv.md" },
  ];
  expect(dependencyFinale(TYPESCRIPT, deps)).toBe(
    TYPESCRIPT.finale +
      " Imports: the standard library plus zod@3.23.8, ajv@8.17.1, ajv-formats@3.0.1; their API is in docs/deps/ajv.md; no other import.",
  );
});

test("Dependency Finale example 3: go replaces its standard-library clause and appends the directive", () => {
  const deps = [
    { name: "github.com/google/go-cmp", version: "v0.7.0", doc: "docs/deps/go-cmp.md" },
    { name: "golang.org/x/text", version: "v0.21.0", doc: null },
  ];
  const text = fixture("language/finale.go.txt");
  expect(dependencyFinale(GO, deps)).toBe(text);
  expect(
    text.startsWith(
      "Go 1.22, the standard library and the modules named at the end (go.mod requires them; the build runs with GOPROXY=off). gofmt-formatted",
    ),
  ).toBe(true);
  expect(text.includes("requires nothing")).toBe(false);
  expect(
    text.endsWith(
      "Imports: the standard library plus github.com/google/go-cmp@v0.7.0, golang.org/x/text@v0.21.0; their API is in docs/deps/go-cmp.md; no other import.",
    ),
  ).toBe(true);
});

test("Dependency Finale example 4: python drops its clause, and a module's directive names its doc", () => {
  expect(dependencyFinale(PYTHON, [{ name: "pyyaml", version: "6.0.2", doc: null }])).toBe(
    "Python 3.10 or later, type hints on every public function. Tests are pytest: plain `assert` on scalars and short values; fixtures and stubs come from `tests/conftest.py`, never your own. Imports: the standard library plus pyyaml@6.0.2; no other import.",
  );
  expect(dependencyDirective([{ name: "a", version: "1", doc: "d/a.md" }])).toBe(
    "the standard library plus a@1; their API is in d/a.md; no other import",
  );
});

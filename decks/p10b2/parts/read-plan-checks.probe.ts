// P10b2 probe for read-plan-checks: readPlanChecks, GUARD_PATH, LOCATOR_PATH by docs/TASK_P10b2_cli.md §2.2, one test
// per record example (Component cli, Function Read Plan Checks 1-3), then the §2.2 rows (the order of the checks, a
// directory is no file, parts from the document, an absolute path, every probe text whole, the repository's own
// decks/p10b/checks.json) and the types. Every tree is a tmp root (tests/helpers.ts); nothing is written elsewhere.
import fs from "node:fs";
import path from "node:path";
import { fileURLToPath } from "node:url";
import { test, expect, expectTypeOf } from "vitest";
import { GUARD_PATH, LOCATOR_PATH, readPlanChecks } from "../../src/cli/readPlanChecks.js";
import type { PlanChecksResult } from "../../src/cli/readPlanChecks.js";
import type { BuildTexts, Checks } from "../../src/builder/types.js";
import type { CommandResult } from "../../src/cli/types.js";
import { fixture, fixtureJson, tmpRoot } from "../../tests/helpers.js";
import type { TmpRoot } from "../../tests/helpers.js";

const REPO = fileURLToPath(new URL("../..", import.meta.url));

function p1Root(): TmpRoot {
  const r = tmpRoot();
  r.write("decks/p1/checks.json", fixture("cli/p1.checks.json"));
  r.write("decks/tools/guard.mjs", "// guard\n");
  r.write("decks/tools/firstdiff.mjs", "// firstdiff\n");
  r.write("decks/p1/parts/a.probe.ts", "// probe a\n");
  r.write("decks/p1/parts/a-judge.probe.ts", "// no\n");
  return r;
}
const failure = (code: 2 | 4, kind: string, message: string): PlanChecksResult =>
  ({ ok: false, result: { code, document: { error: { code, kind, message } } } });
const message = (r: PlanChecksResult): string =>
  (r.ok ? "ok" : (r.result.document as { error: { message: string } }).error.message);

test("Read Plan Checks example 1: the checks, the two texts, the probes of code cards on disk", () => {
  const r = p1Root();
  try {
    expect(readPlanChecks(r.root, "decks/p1/checks.json")).toStrictEqual(fixtureJson("cli/p1.planChecks.json"));
  } finally {
    r.rm();
  }
});

test("Read Plan Checks example 2: a missing checks file, guard, locator", () => {
  const r = p1Root();
  try {
    expect(readPlanChecks(r.root, "nope.json")).toStrictEqual(failure(4, "UsageError", "checks file not found: nope.json"));
    fs.rmSync(r.path("decks/tools/guard.mjs"));
    expect(readPlanChecks(r.root, "decks/p1/checks.json")).toStrictEqual(failure(4, "UsageError", "guard file not found: decks/tools/guard.mjs"));
    r.write("decks/tools/guard.mjs", "// guard\n");
    fs.rmSync(r.path("decks/tools/firstdiff.mjs"));
    expect(readPlanChecks(r.root, "decks/p1/checks.json")).toStrictEqual(failure(4, "UsageError", "locator file not found: decks/tools/firstdiff.mjs"));
  } finally {
    r.rm();
  }
});

test("Read Plan Checks example 3: a document that does not parse, an invalid one", () => {
  const r = p1Root();
  try {
    r.write("c.json", "{");
    const bad = readPlanChecks(r.root, "c.json");
    expect(bad.ok ? 0 : bad.result.code).toBe(2);
    expect(bad.ok ? "" : (bad.result.document as { error: { kind: string } }).error.kind).toBe("DeckError");
    expect(message(bad).startsWith("cannot parse c.json: ")).toBe(true);
    r.write("c.json", '{"cards": []}');
    expect(readPlanChecks(r.root, "c.json")).toStrictEqual(failure(2, "DeckError",
      "c.json is not a valid checks document (2 problems):\nphase: required\ncards: must be a non-empty list"));
  } finally {
    r.rm();
  }
});

test("§2.2: one problem, a top level that is no mapping; the checks come before the guard", () => {
  const r = tmpRoot();
  try {
    r.write("c.json", '{"phase": "p1", "cards": [{"id": "a", "x": 1}]}');
    expect(readPlanChecks(r.root, "c.json")).toStrictEqual(failure(2, "DeckError",
      "c.json is not a valid checks document (1 problem):\ncards[0]: unknown key 'x' (known: id, smoke, extra, files)"));
    r.write("c.json", "[]");
    expect(readPlanChecks(r.root, "c.json")).toStrictEqual(failure(2, "DeckError", "c.json is not a mapping at the top level"));
    r.write("c.json", '{"phase": "p1", "cards": [{"id": "a"}]}');
    expect(message(readPlanChecks(r.root, "c.json"))).toBe("guard file not found: decks/tools/guard.mjs");
    fs.mkdirSync(r.path("d.json"));
    expect(message(readPlanChecks(r.root, "d.json"))).toBe("checks file not found: d.json");
    fs.mkdirSync(r.path("decks/tools/guard.mjs"), { recursive: true });
    expect(message(readPlanChecks(r.root, "c.json"))).toBe("guard file not found: decks/tools/guard.mjs");
  } finally {
    r.rm();
  }
});

test("§2.2: parts from the document, an absolute path, texts whole, probes in checks order", () => {
  const r = tmpRoot();
  try {
    r.write("k/c.json", '{"phase": "q", "parts": "pp/x", "cards": [{"id": "z"}, {"id": "y"}, {"id": "w", "smoke": 2}]}');
    r.write("decks/tools/guard.mjs", "// g\n\n\n");
    r.write("decks/tools/firstdiff.mjs", "// f é\n");
    r.write("pp/x/y.probe.ts", "// y\n\n");
    r.write("pp/x/z.probe.ts", "// z\n");
    r.write("pp/x/w.probe.ts", "// w\n");
    r.write("decks/q/parts/z.probe.ts", "// wrong dir\n");
    const res = readPlanChecks(r.root, r.path("k/c.json"));
    expect(res.ok ? res.texts : null).toStrictEqual({ guard: "// g\n\n\n", firstdiff: "// f é\n",
      probes: { z: "// z\n", y: "// y\n\n", w: "// w\n" } });
    expect(res.ok ? Object.keys(res.texts.probes) : []).toStrictEqual(["z", "y", "w"]);
    expect(res.ok ? res.checks.parts : "").toBe("pp/x");
    expect(GUARD_PATH).toBe("decks/tools/guard.mjs");
    expect(LOCATOR_PATH).toBe("decks/tools/firstdiff.mjs");
  } finally {
    r.rm();
  }
});

test("§2.2: the repository's own decks/p10b/checks.json", () => {
  const res = readPlanChecks(REPO, "decks/p10b/checks.json");
  const ids = ["read-checks", "steps", "probe-dir", "compose", "build-acceptances"];
  expect(res.ok ? res.checks.cards.length : 0).toBe(10);
  expect(res.ok ? Object.keys(res.texts.probes) : []).toStrictEqual(ids);
  for (const id of ids) {
    expect(res.ok ? res.texts.probes[id] : "").toBe(fs.readFileSync(path.join(REPO, "decks/p10b/parts", id + ".probe.ts"), "utf8"));
  }
  expect(res.ok ? res.texts.guard : "").toBe(fs.readFileSync(path.join(REPO, "decks/tools/guard.mjs"), "utf8"));
  expect(res.ok ? res.texts.firstdiff : "").toBe(fs.readFileSync(path.join(REPO, "decks/tools/firstdiff.mjs"), "utf8"));
});

test("§2.2: the types", () => {
  expectTypeOf(readPlanChecks).parameters.toEqualTypeOf<[string, string]>();
  expectTypeOf(readPlanChecks).returns.toEqualTypeOf<PlanChecksResult>();
  expectTypeOf<PlanChecksResult>().toEqualTypeOf<{ ok: true; checks: Checks; texts: BuildTexts } | { ok: false; result: CommandResult }>();
  expectTypeOf(GUARD_PATH).toEqualTypeOf<string>();
});

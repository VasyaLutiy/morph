import fs from "node:fs";
import { test, expect } from "vitest";
import { readPlanChecks } from "../../src/cli/readPlanChecks.js";
import { fixture, fixtureJson, tmpRoot } from "../helpers.js";
import type { TmpRoot } from "../helpers.js";

function p1Root(): TmpRoot {
  const r = tmpRoot();
  r.write("decks/p1/checks.json", fixture("cli/p1.checks.json"));
  r.write("decks/tools/guard.mjs", "// guard\n");
  r.write("decks/tools/firstdiff.mjs", "// firstdiff\n");
  r.write("decks/p1/parts/a.probe.ts", "// probe a\n");
  r.write("decks/p1/parts/a-judge.probe.ts", "// no\n");
  return r;
}

test("Read Plan Checks example 1: every read of the p1 checks, guard, locator and probes", () => {
  const r = p1Root();
  try {
    expect(readPlanChecks(r.root, "decks/p1/checks.json")).toStrictEqual(
      fixtureJson("cli/p1.planChecks.json"),
    );
  } finally {
    r.rm();
  }
});

test("Read Plan Checks example 2: checks, guard and locator not found", () => {
  const r = p1Root();
  try {
    const first = readPlanChecks(r.root, "nope.json");
    expect(first).toStrictEqual({
      ok: false,
      result: { code: 4, document: { error: { code: 4, kind: "UsageError", message: "checks file not found: nope.json" } } },
    });
    fs.rmSync(r.path("decks/tools/guard.mjs"));
    const second = readPlanChecks(r.root, "decks/p1/checks.json");
    expect(second).toStrictEqual({
      ok: false,
      result: { code: 4, document: { error: { code: 4, kind: "UsageError", message: "guard file not found: decks/tools/guard.mjs" } } },
    });
    r.write("decks/tools/guard.mjs", "// guard\n");
    fs.rmSync(r.path("decks/tools/firstdiff.mjs"));
    const third = readPlanChecks(r.root, "decks/p1/checks.json");
    expect(third).toStrictEqual({
      ok: false,
      result: { code: 4, document: { error: { code: 4, kind: "UsageError", message: "locator file not found: decks/tools/firstdiff.mjs" } } },
    });
  } finally {
    r.rm();
  }
});

test("Read Plan Checks example 3: parse failure and an invalid checks document", () => {
  const r = p1Root();
  try {
    r.write("c.json", "{");
    const parsed = readPlanChecks(r.root, "c.json");
    expect(parsed.ok).toBe(false);
    if (!parsed.ok) {
      expect(parsed.result.code).toBe(2);
      const doc = parsed.result.document as { error: { kind: string; message: string } };
      expect(doc.error.kind).toBe("DeckError");
      expect(doc.error.message.startsWith("cannot parse c.json: ")).toBe(true);
    }
    r.write("c.json", JSON.stringify({ cards: [] }));
    const invalid = readPlanChecks(r.root, "c.json");
    expect(invalid).toStrictEqual({
      ok: false,
      result: {
        code: 2,
        document: {
          error: {
            code: 2,
            kind: "DeckError",
            message:
              "c.json is not a valid checks document (2 problems):\nphase: required\ncards: must be a non-empty list",
          },
        },
      },
    });
  } finally {
    r.rm();
  }
});

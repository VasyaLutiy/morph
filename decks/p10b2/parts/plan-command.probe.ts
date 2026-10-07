// P10b2 probe for plan-command: planCommand with args.checks by docs/TASK_P10b2_cli.md §2.2, one test per new record
// example (Component cli, Function Plan Command 6-8: the ledger with checks, a builder error, the end-to-end golden on
// this repository = build.py p10), then the §2.2 rows (no checks = P10a, the map card's override, errors counted,
// nothing written on an error, the read failure passed through, the python map) and the types. The expected
// acceptances are built with the builder's own functions (accepted in P10b1).
import fs from "node:fs";
import path from "node:path";
import { fileURLToPath } from "node:url";
import { test, expect, expectTypeOf } from "vitest";
import { planCommand } from "../../src/cli/planCommand.js";
import { codeAcceptance, judgeAcceptance } from "../../src/builder/compose.js";
import { DEFAULT_FROZEN } from "../../src/builder/readChecks.js";
import { TYPESCRIPT } from "../../src/language/profiles.js";
import { loadDeck } from "../../src/cards/model.js";
import type { CardContext } from "../../src/builder/types.js";
import type { Card } from "../../src/cards/types.js";
import type { CommandResult, PlanArgs, PlanDocument } from "../../src/cli/types.js";
import type { Plan } from "../../src/planner/types.js";
import { fixture, fixtureJson, tmpRoot } from "../../tests/helpers.js";
import type { TmpRoot } from "../../tests/helpers.js";

const REPO = fileURLToPath(new URL("../..", import.meta.url));

function l1Root(): TmpRoot {
  const r = tmpRoot();
  r.write("ledger.yaml", fixture("planner/ledger.yaml"));
  r.write("ledger.map.json", fixture("planner/ledger.map.json"));
  r.write("tests/helpers.ts", "export {};\n");
  r.write("decks/tools/guard.mjs", "// guard\n");
  r.write("decks/tools/firstdiff.mjs", "// firstdiff\n");
  r.write("decks/l1/checks.json", fixture("cli/l1.checks.json"));
  r.write("decks/l1/parts/parse.probe.ts", "// probe\n");
  r.write("decks/l1/parts/ledger-types.probe.ts", "// probe\n");
  return r;
}
const args = (over: Partial<PlanArgs>): PlanArgs => ({ name: "plan", root: ".", pretty: false, spec: "ledger.yaml",
  components: ["ledger", "store"], map: "ledger.map.json", judge: true, out: "decks/p.json", checks: "decks/l1/checks.json", ...over });
const failure = (code: 2 | 4, kind: string, message: string): CommandResult => ({ code, document: { error: { code, kind, message } } });
const ctx = (over: Partial<CardContext>): CardContext => ({
  id: "parse", phase: "l1", targets: ["src/ledger/parse.ts"], siblings: ["src/ledger/types.ts"], frozen: DEFAULT_FROZEN,
  fullExclude: [], ownGit: false, profile: TYPESCRIPT, guard: "// guard\n", firstdiff: "// firstdiff\n", ...over,
});
const JUDGE_FILE = { file: "tests/ledger/parse.examples.test.ts", min: 1, max: 9, lits: [], drop: [], new: false };
function expectedL1(): Card[] {
  const plan = fixtureJson("planner/ledger.plan.json") as Plan;
  return plan.cards.map((c) => c.customId === "parse"
    ? { ...c, acceptance: codeAcceptance(ctx({}), "// probe\n", null, null) }
    : c.customId === "parse-judge"
      ? { ...c, acceptance: judgeAcceptance(ctx({ id: "parse-judge", targets: [JUDGE_FILE.file], siblings: [] }), [JUDGE_FILE]) }
      : c);
}

test("Plan Command example 6: the ledger with checks, the map's acceptance wins", () => {
  const r = l1Root();
  try {
    const plan = fixtureJson("planner/ledger.plan.json") as Plan;
    const cards = expectedL1();
    const res = planCommand(r.root, args({}));
    expect(res).toStrictEqual({ code: 0, document: { ...plan, cards, out: "decks/p.json" } });
    expect(r.read("decks/p.json")).toBe(JSON.stringify(cards, null, 2) + "\n");
    expect(cards.find((c) => c.customId === "ledger-types")?.acceptance).toBe("exit 0\n");
  } finally {
    r.rm();
  }
});

test("Plan Command example 7: a builder error is a DeckError, nothing written", () => {
  const r = l1Root();
  try {
    r.write("decks/l2/checks.json", '{"phase": "l2", "cards": [{"id": "zz"}]}');
    expect(planCommand(r.root, args({ checks: "decks/l2/checks.json" }))).toStrictEqual(failure(2, "DeckError",
      "acceptances not built (1 error):\nchecks card 'zz' is not in the deck"));
    expect(r.exists("decks/p.json")).toBe(false);
  } finally {
    r.rm();
  }
});

test("Plan Command example 8: the end-to-end golden on this repository (= build.py p10)", () => {
  const res = planCommand(REPO, { name: "plan", root: ".", pretty: false, spec: "contour.yaml", components: ["planner", "cli"],
    map: "tests/fixtures/cli/p10.map.json", judge: true, out: null, checks: "decks/p10/checks.json" });
  expect(res.code).toBe(0);
  const doc = res.document as PlanDocument;
  const d = loadDeck(fs.readFileSync(path.join(REPO, "decks/p10/v2deck.json"), "utf8"));
  if (!d.ok) throw new Error("v2deck.json does not load");
  const oldGuard = fixture("builder/guard.p10.txt").trimEnd();
  const liveGuard = fs.readFileSync(path.join(REPO, "decks/tools/guard.mjs"), "utf8").trimEnd();
  expect(d.deck.cards.length).toBe(12);
  for (const card of d.deck.cards) {
    const got = doc.cards.find((c) => c.customId === card.customId);
    expect(got?.acceptance ?? "").toBe((card.acceptance ?? "").split(oldGuard).join(liveGuard));
  }
});

test("§2.2: no checks is the P10a plan; a read failure is the result; nothing written", () => {
  const r = l1Root();
  try {
    const plain = { name: "plan" as const, root: ".", pretty: false, spec: "ledger.yaml", components: ["ledger", "store"],
      map: "ledger.map.json", judge: true, out: null };
    expect(planCommand(r.root, plain)).toStrictEqual({ code: 0, document: { ...(fixtureJson("planner/ledger.plan.json") as Plan), out: null } });
    expect(planCommand(r.root, args({ checks: "decks/none.json" }))).toStrictEqual(failure(4, "UsageError", "checks file not found: decks/none.json"));
    expect(r.exists("decks/p.json")).toBe(false);
    fs.rmSync(r.path("decks/tools/firstdiff.mjs"));
    expect(planCommand(r.root, args({}))).toStrictEqual(failure(4, "UsageError", "locator file not found: decks/tools/firstdiff.mjs"));
    expect(r.exists("decks/p.json")).toBe(false);
    expect(planCommand(r.root, args({ spec: "nope.yaml", checks: "decks/none.json" }))).toStrictEqual(failure(4, "UsageError", "spec file not found: nope.yaml"));
    expect(planCommand(r.root, args({ components: ["nope"], checks: "decks/none.json" }))).toStrictEqual(failure(2, "DeckError",
      "no Component 'nope' in the record (have: ledger, store)"));
  } finally {
    r.rm();
  }
});

test("§2.2: errors counted and joined; a missing probe; the python map", () => {
  const r = l1Root();
  try {
    fs.rmSync(r.path("decks/l1/parts/parse.probe.ts"));
    r.write("decks/l3/checks.json", '{"phase": "l3", "cards": [{"id": "zz"}, {"id": "parse"}]}');
    expect(planCommand(r.root, args({ checks: "decks/l3/checks.json" }))).toStrictEqual(failure(2, "DeckError",
      "acceptances not built (2 errors):\nchecks card 'zz' is not in the deck\ncode card 'parse' has no probe"));
    const py = JSON.parse(fixture("planner/ledger.map.json")) as Record<string, unknown>;
    r.write("py.map.json", JSON.stringify({ ...py, language: "python" }));
    const res = planCommand(r.root, args({ map: "py.map.json" }));
    expect(res.code === 0 ? "planned" : (res.document as { error: { message: string } }).error.message)
      .toBe("acceptances not built (1 error):\nno acceptance builder for language 'python' (only typescript)");
    expect(r.exists("decks/p.json")).toBe(false);
  } finally {
    r.rm();
  }
});

test("§2.2: a map card's acceptance wins by its custom id; the others are built", () => {
  const r = l1Root();
  try {
    const m = JSON.parse(fixture("planner/ledger.map.json")) as { cards: Record<string, Record<string, unknown>> };
    m.cards["parse-entry"] = { ...m.cards["parse-entry"], acceptance: "exit 3\n" };
    r.write("ov.map.json", JSON.stringify(m));
    const res = planCommand(r.root, args({ map: "ov.map.json", out: null }));
    const cards = (res.document as PlanDocument).cards;
    expect(res.code).toBe(0);
    expect(cards.find((c) => c.customId === "parse")?.acceptance).toBe("exit 3\n");
    expect(cards.find((c) => c.customId === "ledger-types")?.acceptance).toBe("exit 0\n");
    expect(cards.find((c) => c.customId === "parse-judge")?.acceptance)
      .toBe(judgeAcceptance(ctx({ id: "parse-judge", targets: [JUDGE_FILE.file], siblings: [] }), [JUDGE_FILE]));
    expect(cards.map((c) => c.customId)).toStrictEqual(expectedL1().map((c) => c.customId));
  } finally {
    r.rm();
  }
});

test("§2.2: the types", () => {
  expectTypeOf(planCommand).parameters.toEqualTypeOf<[string, PlanArgs]>();
  expectTypeOf(planCommand).returns.toEqualTypeOf<CommandResult>();
});

// P10a probe for plan-command: planCommand, EMPTY_MAP, main's plan dispatch by docs/TASK_P10a_planner.md §2.2,
// one test per record example (Component cli: Plan Command 1-4; example 5 calls main with a plan argv, which parses
// only from parse-command on, generation 4: it is in that card's probe), then the §2.2 rows and the types. The
// harness is §2.1's, verbatim: a tmp root holding the planner fixtures' texts.
import { test, expect, expectTypeOf } from "vitest";
import { EMPTY_MAP, planCommand } from "../../src/cli/planCommand.js";
import { readDeckFile } from "../../src/cli/document.js";
import type { Command, CommandResult, PlanArgs, PlanDocument } from "../../src/cli/types.js";
import type { ContourMap } from "../../src/contour/types.js";
import type { Plan } from "../../src/planner/types.js";
import { fixture, fixtureJson, tmpRoot } from "../../tests/helpers.js";
import type { TmpRoot } from "../../tests/helpers.js";

function ledgerRoot(): TmpRoot {
  const r = tmpRoot();
  r.write("ledger.yaml", fixture("planner/ledger.yaml"));
  r.write("ledger.map.json", fixture("planner/ledger.map.json"));
  r.write("tests/helpers.ts", "export {};\n");
  return r;
}
const args = (over: Partial<PlanArgs>): PlanArgs => ({ name: "plan", root: ".", pretty: false, spec: "ledger.yaml",
  components: ["ledger", "store"], map: "ledger.map.json", judge: true, out: null, ...over });
const failure = (code: 2 | 4, kind: string, message: string): CommandResult => ({ code, document: { error: { code, kind, message } } });

test("Plan Command example 1: the ledger plan, the deck file written and readable", () => {
  const r = ledgerRoot();
  try {
    const res = planCommand(r.root, args({ out: "decks/p.json" }));
    const plan = fixtureJson("planner/ledger.plan.json") as Plan;
    expect(res).toStrictEqual({ code: 0, document: { ...plan, out: "decks/p.json" } });
    expect(r.read("decks/p.json")).toBe(JSON.stringify(plan.cards, null, 2) + "\n");
    const d = readDeckFile(r.root, "decks/p.json");
    expect(d.ok ? d.deck.cards.length : -1).toBe(17);
    expect(d.ok ? d.deck.externalDependsOn : null).toStrictEqual(["outside"]);
  } finally {
    r.rm();
  }
});

test("Plan Command example 2: a missing spec, a missing map", () => {
  const r = ledgerRoot();
  try {
    expect(planCommand(r.root, args({ spec: "nope.yaml" }))).toStrictEqual(failure(4, "UsageError", "spec file not found: nope.yaml"));
    expect(planCommand(r.root, args({ map: "m.json" }))).toStrictEqual(failure(4, "UsageError", "map file not found: m.json"));
  } finally {
    r.rm();
  }
});

test("Plan Command example 3: an invalid record, an invalid map", () => {
  const r = ledgerRoot();
  try {
    r.write("bad.yaml", "System: {}\n");
    r.write("m.json", '{"docs": "x"}');
    expect(planCommand(r.root, args({ spec: "bad.yaml" }))).toStrictEqual(failure(2, "DeckError",
      "bad.yaml is not a valid record (3 problems):\nSystem.name: required\nSystem.description: required\nSystem.groups: required"));
    expect(planCommand(r.root, args({ map: "m.json" }))).toStrictEqual(failure(2, "DeckError",
      "m.json is not a valid map (1 problem):\ndocs: must be a list"));
  } finally {
    r.rm();
  }
});

test("Plan Command example 4: a plan error writes nothing", () => {
  const r = ledgerRoot();
  try {
    expect(planCommand(r.root, args({ components: ["nope"], out: "decks/q.json" })))
      .toStrictEqual(failure(2, "DeckError", "no Component 'nope' in the record (have: ledger, store)"));
    expect(r.exists("decks/q.json")).toBe(false);
  } finally {
    r.rm();
  }
});

test("§2.2: no map is the empty map; hasFile looks under the root; the document's keys", () => {
  const r = ledgerRoot();
  try {
    const res = planCommand(r.root, args({ map: null, components: ["ledger"] }));
    const doc = res.document as PlanDocument;
    expect(res.code).toBe(0);
    expect(Object.keys(doc)).toStrictEqual(["spec", "components", "cards", "generations", "externalDependsOn", "out"]);
    expect(doc.cards.map((c) => c.customId)).toStrictEqual(["parse-entry", "parse-entry-judge", "sum-entries", "check-ledger",
      "format-report", "sum-entries-judge", "check-ledger-judge", "format-report-judge", "ledger-cli", "ledger-cli-judge"]);
    expect(doc.cards.find((c) => c.customId === "parse-entry-judge")?.contextSlice).toStrictEqual(["src/ledger/parseEntry.ts", "tests/helpers.ts"]);
    const nj = planCommand(r.root, args({ judge: false, out: "d.json" }));
    expect(nj.code).toBe(0);
    expect(r.exists("d.json")).toBe(true);
    const empty: ContourMap = { version: 1, package: null, language: null, docs: [], groups: [], cards: [], extraCards: [] };
    expect(EMPTY_MAP).toStrictEqual(empty);
  } finally {
    r.rm();
  }
});

test("§2.2: the types", () => {
  expectTypeOf(planCommand).parameters.toEqualTypeOf<[string, PlanArgs]>();
  expectTypeOf(planCommand).returns.toEqualTypeOf<CommandResult>();
  expectTypeOf<PlanArgs>().toEqualTypeOf<{
    name: "plan"; root: string; pretty: boolean; spec: string; components: string[]; map: string | null; judge: boolean; out: string | null;
  }>();
  expectTypeOf<Extract<Command, { name: "plan" }>>().toEqualTypeOf<PlanArgs>();
  expectTypeOf<PlanDocument>().toEqualTypeOf<{ spec: string; components: string[]; cards: Plan["cards"]; generations: string[][];
    externalDependsOn: Record<string, string[]>; out: string | null }>();
});

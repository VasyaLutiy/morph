// P34b probe for plan-command by docs/TASK_P34b_contour.md §2.2 (src/cli/planCommand.ts) — issue #44: Plan Spec's
// warnings join the document's, last; the Contour records' cards carry their Events and Interface contract. Record
// Plan Command examples 1, 16, 17, 18 (examples.json). Needs plan-spec (and render, cut-component for 18).
import { test, expect } from "vitest";
import { planCommand } from "../../src/cli/planCommand.js";
import { fixture, fixtureJson, tmpRoot } from "../../tests/helpers.js";
import type { PlanArgs, PlanDocument } from "../../src/cli/types.js";

type Doc = PlanDocument & { warnings?: string[] };
const ARGS: PlanArgs = { name: "plan", root: ".", pretty: false, spec: "contour.yaml", components: [], map: "morph-map.json", judge: false, out: null };
const LEDGER_WARNINGS = [
  "ledger/Sum Entries: step produces 'number' names no Data Object or Event of the record",
  "ledger/Format Report: step produces 'string' names no Data Object or Event of the record",
];

function parity(name: string, components: string[], judge: boolean): Doc {
  const r = tmpRoot();
  try {
    r.write("contour.yaml", fixture("contour/parity/" + name + ".contour.yaml"));
    r.write("morph-map.json", fixture("contour/parity/" + name + ".map.json"));
    const res = planCommand(r.root, { ...ARGS, components, judge });
    expect(res.code).toBe(0);
    return res.document as Doc;
  } finally {
    r.rm();
  }
}

test("Plan Command example 1: the ledger document ends with Plan Spec's two warnings", () => {
  const r = tmpRoot();
  try {
    r.write("ledger.yaml", fixture("planner/ledger.yaml"));
    r.write("ledger.map.json", fixture("planner/ledger.map.json"));
    r.write("tests/helpers.ts", "export {};\n");
    const res = planCommand(r.root, { ...ARGS, spec: "ledger.yaml", map: "ledger.map.json", components: ["ledger", "store"], judge: true, out: "decks/p.json" });
    expect(res.code).toBe(0);
    const doc = res.document as Doc;
    expect(doc.warnings).toStrictEqual(LEDGER_WARNINGS);
    expect(Object.keys(doc).at(-1)).toBe("warnings");
  } finally {
    r.rm();
  }
});

test("unchanged: Plan Command example 1, the ledger cards equal ledger.plan.json's", () => {
  const r = tmpRoot();
  try {
    r.write("ledger.yaml", fixture("planner/ledger.yaml"));
    r.write("ledger.map.json", fixture("planner/ledger.map.json"));
    r.write("tests/helpers.ts", "export {};\n");
    const res = planCommand(r.root, { ...ARGS, spec: "ledger.yaml", map: "ledger.map.json", components: ["ledger", "store"], judge: true, out: null });
    expect((res.document as Doc).cards).toStrictEqual((fixtureJson("planner/ledger.plan.json") as PlanDocument).cards);
  } finally {
    r.rm();
  }
});

test("Plan Command example 16: ccledger warns its 6 Functions without examples", () => {
  const want = fixtureJson("contour/parity/expected.json") as Record<string, { warnings: string[] }>;
  expect(parity("ccledger", [], false).warnings).toStrictEqual(want["ccledger"].warnings);
  expect(parity("contour-engine", ["contour-engine"], false).warnings).toStrictEqual(want["contour-engine"].warnings);
});

test("Plan Command example 17: the record's warnings, the language, then Plan Spec's", () => {
  const r = tmpRoot();
  try {
    r.write("contour.json", fixture("contour/contourKeys.json"));
    const res = planCommand(r.root, { ...ARGS, spec: "contour.json", map: null, components: ["orders", "catalog"] });
    expect(res.code).toBe(0);
    expect((res.document as Doc).warnings).toStrictEqual([
      ...(fixtureJson("contour/contourKeys.warnings.json") as string[]),
      "no language on Component catalog and none in the map: typescript assumed",
      "orders/Place Order: no examples, no judge",
      "catalog/List Prices: no examples, no judge",
    ]);
  } finally {
    r.rm();
  }
});

test("Plan Command example 18: the Contour records' cards carry their Events and Interface contract", () => {
  const L = fixtureJson("contour/parity/lines.json") as Record<string, Record<string, string[]>>;
  const docs: Record<string, Doc> = { ccledger: parity("ccledger", [], true), "contour-engine": parity("contour-engine", ["contour-engine"], true) };
  for (const [name, byId] of Object.entries(L)) {
    for (const [id, texts] of Object.entries(byId)) {
      const card = docs[name].cards.find((c) => c.customId === id);
      for (const text of texts) expect(card?.instruction).toContain(text);
    }
  }
  expect(docs["contour-engine"].cards.map((c) => c.customId)).toStrictEqual(["diagram", "schema", "store", "diagram-judge", "engine", "schema-judge", "store-judge", "mcp", "rest"]);
});

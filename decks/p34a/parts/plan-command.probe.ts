// P34a probe for plan-command by docs/TASK_P34a_contour.md §2.2 (src/cli/planCommand.ts) — issue #44: the plan
// document carries the loader's warnings and the language warning, last and only when non-empty. Record Plan Command
// examples 16 and 17 (examples.json); Plan Command 1's document keeps no warnings key. Needs validate-record and
// load-spec: on the stubs the two Contour records still exit 2.
import { test, expect } from "vitest";
import { planCommand } from "../../src/cli/planCommand.js";
import { fixture, fixtureJson, tmpRoot } from "../../tests/helpers.js";
import type { PlanArgs, PlanDocument } from "../../src/cli/types.js";

type Want = { cards: { customId: string; dependsOn: string[]; targets: string[] }[]; generations: string[][]; warnings: string[] };
const WANT = (): Record<string, Want> => fixtureJson("contour/parity/expected.json") as Record<string, Want>;
const ARGS: PlanArgs = { name: "plan", root: ".", pretty: false, spec: "contour.yaml", components: [], map: "morph-map.json", judge: false, out: null };
type Doc = PlanDocument & { warnings?: string[] };

function parity(name: string, components: string[], judge: boolean): void {
  const r = tmpRoot();
  try {
    r.write("contour.yaml", fixture("contour/parity/" + name + ".contour.yaml"));
    r.write("morph-map.json", fixture("contour/parity/" + name + ".map.json"));
    const res = planCommand(r.root, { ...ARGS, components, judge });
    expect(res.code).toBe(0);
    const doc = res.document as Doc;
    const want = WANT()[name];
    expect(doc.cards.map((c) => ({ customId: c.customId, dependsOn: c.dependsOn, targets: c.targets }))).toStrictEqual(want.cards);
    expect(doc.generations).toStrictEqual(want.generations);
    expect(doc.warnings).toStrictEqual(want.warnings);
  } finally {
    r.rm();
  }
}

test("Plan Command example 16: ccledger cuts the old deck's cards and generations, one language warning", () => {
  parity("ccledger", [], false);
});

test("Plan Command example 16: ccledger with judge true, the same six cards", () => {
  parity("ccledger", [], true);
});

test("Plan Command example 16: contour-engine cuts the old deck's cards and generations, one language warning", () => {
  parity("contour-engine", ["contour-engine"], false);
});

test("Plan Command example 17: the contour-keys record, the loader's 10 warnings then the language warning, last", () => {
  const r = tmpRoot();
  try {
    r.write("contour.json", fixture("contour/contourKeys.json"));
    const res = planCommand(r.root, { ...ARGS, spec: "contour.json", map: null, components: ["orders", "catalog"] });
    expect(res.code).toBe(0);
    const doc = res.document as Doc;
    expect(doc.warnings).toStrictEqual([
      ...(fixtureJson("contour/contourKeys.warnings.json") as string[]),
      "no language on Component catalog and none in the map: typescript assumed",
    ]);
    expect(Object.keys(doc).at(-1)).toBe("warnings");
    expect(doc.generations).toStrictEqual([["cancel-order", "list-prices", "place-order"], ["orders-api"]]);
  } finally {
    r.rm();
  }
});

test("Plan Command example 1 (unchanged): the ledger document has no warnings key", () => {
  const r = tmpRoot();
  try {
    r.write("ledger.yaml", fixture("planner/ledger.yaml"));
    r.write("ledger.map.json", fixture("planner/ledger.map.json"));
    const res = planCommand(r.root, { ...ARGS, spec: "ledger.yaml", map: "ledger.map.json", components: ["ledger", "store"], judge: true });
    expect(res.code).toBe(0);
    expect("warnings" in (res.document as Record<string, unknown>)).toBe(false);
  } finally {
    r.rm();
  }
});

import { test, expect } from "vitest";
import { orderDeck, planSpec } from "../../src/planner/plan.js";
import { loadDeck } from "../../src/cards/model.js";
import { fixture, fixtureJson } from "../helpers.js";
import { loadContour, loadMap } from "../../src/contour/load.js";
import type { Card } from "../../src/cards/types.js";
import type { ContourMap, ContourRecord } from "../../src/contour/types.js";
import type { PlanInput } from "../../src/planner/types.js";

function record(name: string): ContourRecord {
  const r = loadContour(fixture(name), name);
  if (!r.ok) throw new Error(r.error);
  return r.record;
}
function contourMap(name: string): ContourMap {
  const m = loadMap(fixture(name), name);
  if (!m.ok) throw new Error(m.error);
  return m.map;
}
const REC = record("planner/ledger.yaml");
const MAP = contourMap("planner/ledger.map.json");

const card = (id: string, dependsOn: string[]): Card => ({
  customId: id,
  intent: "patch",
  targets: ["src/" + id + ".ts"],
  contextSlice: [],
  instruction: "x",
  acceptance: null,
  model: null,
  maxTokens: null,
  reasoning: null,
  variants: 1,
  dependsOn,
});

const input = (over: Partial<PlanInput>): PlanInput => ({
  record: REC,
  map: MAP,
  spec: "ledger.yaml",
  components: ["ledger", "store"],
  judge: true,
  hasFile: (p: string): boolean => p === "tests/helpers.ts",
  ...over,
});

test("Order Deck example 1: the layered deck reversed orders into three generations", () => {
  const layered = loadDeck(fixture("decks/layered.json"));
  if (!layered.ok) throw new Error("layered fixture is not a valid deck");
  const reversed = [...layered.deck.cards].reverse().map((c) => card(c.customId, c.dependsOn));
  const r = orderDeck(reversed);
  expect(r.ok).toBe(true);
  if (!r.ok) return;
  expect(r.cards.map((c) => c.customId)).toStrictEqual(["a", "b", "c", "d"]);
  expect(r.generations).toStrictEqual([["a"], ["b", "c"], ["d"]]);
  expect(r.externalDependsOn).toStrictEqual({});
  const expected = layered.deck.cards.map((c) => card(c.customId, c.dependsOn));
  expect(r.cards).toStrictEqual(expected);
});

test("Order Deck example 2: external dependencies are collected per card in sorted order", () => {
  const r = orderDeck([card("z", ["y", "ext"]), card("y", []), card("x", ["ext2", "y"])]);
  expect(r.ok).toBe(true);
  if (!r.ok) return;
  expect(r.cards.map((c) => c.customId)).toStrictEqual(["y", "x", "z"]);
  expect(r.generations).toStrictEqual([["y"], ["x", "z"]]);
  expect(r.externalDependsOn).toStrictEqual({ x: ["ext2"], z: ["ext"] });
  expect(JSON.stringify(r.externalDependsOn)).toBe('{"x":["ext2"],"z":["ext"]}');
});

test("Order Deck example 3: a cycle lists every pending id sorted", () => {
  const r = orderDeck([card("a", ["b"]), card("b", ["a"]), card("c", [])]);
  expect(r).toStrictEqual({ ok: false, error: "dependency cycle among a, b" });
});

test("Plan Spec example 1: the ledger fixture equals the old mrph's golden cut", () => {
  const r = planSpec(input({}));
  expect(r.ok).toBe(true);
  if (!r.ok) return;
  const golden = fixtureJson("planner/ledger.golden.json") as {
    cards: { customId: string; dependsOn: string[] }[];
    generations: string[][];
    externalDependsOn: Record<string, string[]>;
  };
  expect(r.plan.cards.map((c) => ({ customId: c.customId, dependsOn: c.dependsOn }))).toStrictEqual(
    golden.cards,
  );
  expect(r.plan.generations).toStrictEqual(golden.generations);
  expect(r.plan.externalDependsOn).toStrictEqual(golden.externalDependsOn);
  expect(r.plan.externalDependsOn).toStrictEqual({ "format-report": ["outside"] });
  expect(r.plan.cards.length).toBe(17);
  expect(r.plan.generations.length).toBe(5);
  expect(r.plan).toStrictEqual(fixtureJson("planner/ledger.plan.json"));
  for (const c of r.plan.cards) {
    expect(c.contextSlice.includes("ledger.yaml")).toBe(false);
  }
  expect(r.uses).toStrictEqual({});
});

test("Plan Spec example 2: store alone, no judges, extras filtered by Component", () => {
  const r = planSpec(input({ components: ["store"], judge: false }));
  expect(r.ok).toBe(true);
  if (!r.ok) return;
  expect(r.plan.cards.map((c) => c.customId)).toStrictEqual([
    "load-ledger",
    "notes",
    "save-ledger",
    "store-schema",
  ]);
  expect(r.plan.generations).toStrictEqual([
    ["load-ledger", "notes", "save-ledger", "store-schema"],
  ]);
  expect(r.plan.externalDependsOn).toStrictEqual({
    notes: ["parse"],
    "save-ledger": ["format-report"],
  });
  const save = r.plan.cards.find((c) => c.customId === "save-ledger");
  expect(save?.contextSlice).toStrictEqual(["docs/TASK.md"]);
});

test("Plan Spec example 3: the spec file is dropped from an override's slice", () => {
  const r = planSpec(
    input({
      map: {
        ...MAP,
        cards: MAP.cards.map((c) =>
          c.id === "parse-entry" ? { ...c, contextSlice: ["ledger.yaml", "docs/A.md"] } : c,
        ),
      },
      components: ["ledger"],
      judge: false,
    }),
  );
  expect(r.ok).toBe(true);
  if (!r.ok) return;
  const parse = r.plan.cards.find((c) => c.customId === "parse");
  expect(parse?.contextSlice).toStrictEqual(["docs/A.md"]);
});

test("Plan Spec example 4: every failure names its cause", () => {
  const cobol = planSpec(
    input({
      map: { ...MAP, language: "cobol" },
      components: ["ledger"],
      judge: false,
    }),
  );
  expect(cobol).toStrictEqual({
    ok: false,
    error: "the map: unknown language 'cobol' (known: typescript, python, go)",
  });

  const nope = planSpec(input({ components: ["nope"], judge: false }));
  expect(nope).toStrictEqual({
    ok: false,
    error: "no Component 'nope' in the record (have: ledger, store)",
  });

  const nowhere = planSpec(
    input({
      map: {
        ...MAP,
        extraCards: MAP.extraCards.map((e) =>
          e.customId === "store-schema" ? { ...e, component: "Nowhere" } : e,
        ),
      },
      components: ["store"],
      judge: false,
    }),
  );
  expect(nowhere).toStrictEqual({
    ok: false,
    error:
      "extra card 'store-schema' names Component 'Nowhere' the record does not have (have: ledger, store)",
  });

  const duplicate = planSpec(
    input({
      map: {
        ...MAP,
        extraCards: MAP.extraCards.map((e) =>
          e.customId === "ledger-types" ? { ...e, customId: "parse" } : e,
        ),
      },
      components: ["ledger"],
      judge: false,
    }),
  );
  expect(duplicate).toStrictEqual({ ok: false, error: "duplicate customId 'parse'" });

  const cycle = planSpec(
    input({
      map: {
        ...MAP,
        cards: MAP.cards.map((c) =>
          c.id === "parse-entry" ? { ...c, dependsOn: ["checks"] } : c,
        ),
      },
      components: ["ledger"],
      judge: false,
    }),
  );
  expect(cycle).toStrictEqual({
    ok: false,
    error: "dependency cycle among checks, format-report, ledger-cli, notes, parse",
  });
});

test("Plan Spec example 5: this repository's own record gives the P9 deck", () => {
  const repoRecord = record("../../contour.yaml");
  const repoMap = contourMap("../../morph-map.json");
  const r = planSpec({
    record: repoRecord,
    map: repoMap,
    spec: "contour.yaml",
    components: ["contour"],
    judge: true,
    hasFile: (): boolean => true,
  });
  expect(r.ok).toBe(true);
  if (!r.ok) return;
  expect(r.plan.generations).toStrictEqual([
    ["validate-record"],
    ["select-components", "validate-map", "validate-record-judge"],
    ["load-spec", "select-components-judge", "validate-map-judge"],
    ["load-spec-judge"],
  ]);
  const entries = new Map<string, { acceptance: string | null }>();
  for (const c of repoMap.cards) entries.set(c.id, c);
  for (const e of repoMap.extraCards) {
    if (e.customId !== null) entries.set(e.customId, e);
  }
  for (const c of r.plan.cards) {
    const m = entries.get(c.customId);
    if (m !== undefined && m.acceptance !== null) {
      expect(c.acceptance).toStrictEqual(m.acceptance);
    }
  }
});

test("orderDeck does not change the input order", () => {
  const cards = [card("d", ["b", "c"]), card("c", ["a"]), card("b", ["a"]), card("a", [])];
  const r = orderDeck(cards);
  expect(r.ok).toBe(true);
  expect(cards.map((c) => c.customId)).toStrictEqual(["d", "c", "b", "a"]);
});

test("planSpec with no --component on a multi-Component record names them", () => {
  const r = planSpec(input({ components: [], judge: false }));
  expect(r).toStrictEqual({
    ok: false,
    error: "the record has 2 Components (ledger, store): pass --component",
  });
});

test("planSpec lists the selected Components in the order given", () => {
  const r = planSpec(input({ components: ["store", "ledger"], judge: false }));
  expect(r.ok).toBe(true);
  if (!r.ok) return;
  expect(r.plan.components).toStrictEqual(["store", "ledger"]);
});

test("Plan Spec example 6: dependency docs ride in the slices of the Components that use them", () => {
  const rec = loadContour(fixture("planner/deps.yaml"), "deps.yaml");
  if (!rec.ok) throw new Error(rec.error);
  const m = loadMap(fixture("planner/deps.map.json"), "deps.map.json");
  if (!m.ok) throw new Error(m.error);
  const r = planSpec({
    record: rec.record,
    map: m.map,
    spec: "deps.yaml",
    components: ["conf", "diff", "plain"],
    judge: true,
    hasFile: (): boolean => true,
  });
  expect(r.ok).toBe(true);
  if (!r.ok) return;
  const sliceOf = (id: string): string[] | undefined =>
    r.plan.cards.find((c) => c.customId === id)?.contextSlice;
  expect(sliceOf("read-config")).toStrictEqual(["docs/TASK.md", "docs/deps/yaml.md"]);
  expect(sliceOf("check-config")).toStrictEqual(["docs/X.md", "docs/deps/yaml.md"]);
  expect(sliceOf("read-config-judge")).toStrictEqual([
    "docs/TASK.md",
    "src/conf/readConfig.ts",
    "tests/helpers.ts",
    "docs/deps/yaml.md",
  ]);
  expect(sliceOf("check-config-judge")).toStrictEqual([
    "docs/TASK.md",
    "src/conf/checkConfig.ts",
    "tests/helpers.ts",
    "docs/deps/yaml.md",
  ]);
  expect(sliceOf("diff-values")).toStrictEqual(["docs/TASK.md", "docs/deps/go-cmp.md"]);
  expect(sliceOf("diff-values-judge")).toStrictEqual([
    "docs/TASK.md",
    "diff/diff_values.go",
    "internal/testhelp/testhelp.go",
    "docs/deps/go-cmp.md",
  ]);
  expect(sliceOf("pad-left")).toStrictEqual(["docs/TASK.md"]);
  expect(sliceOf("pad-left-judge")).toStrictEqual([
    "docs/TASK.md",
    "src/plain/padLeft.ts",
    "tests/helpers.ts",
  ]);
  expect(r.uses).toStrictEqual({
    "read-config": ["yaml", "zod"],
    "check-config": ["yaml", "zod"],
    "diff-values": ["github.com/google/go-cmp"],
  });
  expect(r.plan.generations).toStrictEqual([
    ["diff-values", "pad-left", "read-config"],
    ["check-config", "diff-values-judge", "pad-left-judge", "read-config-judge"],
    ["check-config-judge"],
  ]);
});

test("Plan Spec example 7: a missing dependency doc is a plan fault", () => {
  const rec = loadContour(fixture("planner/deps.yaml"), "deps.yaml");
  if (!rec.ok) throw new Error(rec.error);
  const m = loadMap(fixture("planner/deps.map.json"), "deps.map.json");
  if (!m.ok) throw new Error(m.error);

  const first = planSpec({
    record: rec.record,
    map: m.map,
    spec: "deps.yaml",
    components: ["conf", "diff"],
    judge: false,
    hasFile: (p: string): boolean => p !== "docs/deps/go-cmp.md",
  });
  expect(first).toStrictEqual({
    ok: false,
    error:
      "dependency 'github.com/google/go-cmp' of Component 'diff': doc file not found: docs/deps/go-cmp.md",
  });

  const second = planSpec({
    record: rec.record,
    map: m.map,
    spec: "deps.yaml",
    components: ["conf"],
    judge: false,
    hasFile: (): boolean => false,
  });
  expect(second).toStrictEqual({
    ok: false,
    error: "dependency 'yaml' of Component 'conf': doc file not found: docs/deps/yaml.md",
  });

  const third = planSpec({
    record: rec.record,
    map: m.map,
    spec: "deps.yaml",
    components: ["plain"],
    judge: true,
    hasFile: (): boolean => false,
  });
  expect(third.ok).toBe(true);
  if (!third.ok) return;
  expect(third.uses).toStrictEqual({});
});

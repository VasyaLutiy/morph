// P30 probe for layer-edges by docs/TASK_P30_rules.md §2.2 (src/rules/layers.ts, NEW) — issue #41: the layer rules
// come from the record. Record Component rules: Layer Edges 1-4, Card Layers 1, Layers Arg 1-3, Plan Layers 1-3. The
// guard examples run the template guards (data of this phase) on the argument layersArg writes.
import { spawnSync } from "node:child_process";
import path from "node:path";
import { test, expect } from "vitest";
import { cardLayers, layerEdges, layersArg, planLayers } from "../../src/rules/layers.js";
import { loadContour, loadMap } from "../../src/contour/load.js";
import { EMPTY_MAP } from "../../src/cli/planCommand.js";
import { GO, TYPESCRIPT } from "../../src/language/profiles.js";
import { allowArg } from "../../src/builder/compose.js";
import { fixture, fixtureJson, fixturePath, tmpRoot } from "../../tests/helpers.js";
import type { ContourMap, ContourRecord } from "../../src/contour/types.js";

function load(record: string, map: string | null): { record: ContourRecord; map: ContourMap } {
  const R = loadContour(record, "contour.yaml");
  if (!R.ok) throw new Error("fixture record: " + R.error);
  if (map === null) return { record: R.record, map: EMPTY_MAP };
  const M = loadMap(map, "morph-map.json");
  if (!M.ok) throw new Error("fixture map: " + M.error);
  return { record: R.record, map: M.map };
}
const ts = (): { record: ContourRecord; map: ContourMap } => {
  const files = fixtureJson("ts-rename.json") as Record<string, string>;
  return load(files["contour.yaml"], files["morph-map.json"]);
};
const both = (): { record: ContourRecord; map: ContourMap } => load(fixture("rules/both.yaml"), null);
const E = (): Record<string, string[]> => fixtureJson("rules/morphstudio.edges.json") as Record<string, string[]>;

const ROOT = path.resolve(fixturePath("."), "..", "..");
const GUARD = (lang: string): string => path.join(ROOT, "templates", lang, "decks", "tools", "guard.mjs");
const ENV = { ...process.env, GOFLAGS: "-mod=mod", GOPROXY: "off", GOTOOLCHAIN: "local", GOWORK: "off" };
const run = (cwd: string, lang: string, args: string[]): { status: number | null; stdout: string } => {
  const r = spawnSync("node", [GUARD(lang), ...args], { cwd, encoding: "utf8", env: ENV });
  return { status: r.status, stdout: r.stdout };
};
// the shell words of allowArg([]) + layersArg([], L): '' and the JSON (checked against the string first)
const words = (L: Record<string, string[]>): string[] => {
  expect(allowArg([]) + layersArg([], L)).toBe(" '' '" + JSON.stringify(L) + "'");
  return ["", JSON.stringify(L)];
};

test("Layer Edges example 1: ts-rename, Length Line uses units", () => {
  const { record, map } = ts();
  expect(layerEdges(record, map)).toStrictEqual({ ok: true, edges: { "src/report": ["src/units"], "src/units": [] } });
});

test("Layer Edges example 2: the trimmed MorphStudio record gives 18 directories, 30 pairs, each in the hand table", () => {
  const { record, map } = load(fixture("rules/morphstudio/contour.yaml"), fixture("rules/morphstudio/morph-map.json"));
  const got = layerEdges(record, map);
  expect(got).toStrictEqual({ ok: true, edges: E() });
  const table = (fixtureJson("rules/morphstudio/layers.json") as { layers: Record<string, string[]> }).layers;
  const outside: string[] = [];
  for (const [dir, dirs] of Object.entries(E())) {
    if (dir === "users") continue;
    for (const d of dirs) if (!table[dir].includes(d)) outside.push(dir + " -> " + d);
  }
  expect(outside).toStrictEqual([]);
  expect([Object.keys(E()).length, Object.values(E()).flat().length]).toStrictEqual([18, 30]);
});

test("Layer Edges example 3: two Components in one package take the union; dependencies, free words and own uses add nothing", () => {
  const { record, map } = load(fixture("rules/union/contour.yaml"), fixture("rules/union/morph-map.json"));
  expect(layerEdges(record, map)).toStrictEqual({ ok: true, edges: { gamma: ["pkg"], pkg: ["x", "y"], x: [], y: [] } });
});

test("Layer Edges example 4: a Component and a dependency with one name", () => {
  const { record, map } = both();
  expect(layerEdges(record, map)).toStrictEqual({
    ok: false,
    errors: ["Function 'Read Config': 'uses: yaml' names the Component 'yaml' and the dependency 'yaml'"],
  });
});

test("Card Layers example 1: a card's code directories with their edges", () => {
  expect(cardLayers(GO, ["users/registry.go"], E())).toStrictEqual({ users: [] });
  expect(cardLayers(GO, ["daemon/pump.go", "daemon/pump_test.go"], E())).toStrictEqual({ daemon: E()["daemon"] });
  expect(E()["daemon"].length).toBe(11);
  expect(cardLayers(TYPESCRIPT, ["src/report/line.ts", "tests/report/line.test.ts"], { "src/report": ["src/units"], "src/units": [] }))
    .toStrictEqual({ "src/report": ["src/units"] });
  const order = cardLayers(GO, ["new/a.go", "new/b.go", "main.go"], {});
  expect(order).toStrictEqual({ new: [], ".": [] });
  expect(Object.keys(order)).toStrictEqual(["new", "."]);
  expect(cardLayers(GO, ["users/registry_examples_test.go"], E())).toStrictEqual({});
});

test("Layers Arg example 1: the argument after allowArg's", () => {
  expect(layersArg([], undefined)).toBe("");
  expect(layersArg(["zod"], undefined)).toBe("");
  expect(layersArg([], { users: [] })).toBe(" '' '{\"users\":[]}'");
  expect(layersArg(["github.com/x/y"], { pkg: ["x", "y"], ".": [] })).toBe(" '{\"pkg\":[\"x\",\"y\"],\".\":[]}'");
});

test("Layers Arg example 2: the Go guard reads the argument, not layers.json's layers", () => {
  const r = tmpRoot("morph-p30-go-");
  try {
    r.write("go.mod", "module m\n\ngo 1.22\n");
    r.write("x/x.go", "package x\n\nconst X = 1\n");
    r.write("y/y.go", "package y\n\nconst Y = 2\n");
    r.write("queue/q.go", "package queue\n\nconst Q = 3\n");
    r.write("users/u.go", "package users\n\nconst U = 4\n");
    r.write("pkg/a.go", "package pkg\n\nimport \"m/x\"\n\nconst A = x.X\n");
    r.write("pkg/b.go", "package pkg\n\nimport \"m/y\"\n\nconst B = y.Y\n");
    r.write("registry/x.go", "package registry\n\nimport (\n\t\"m/queue\"\n\t\"m/users\"\n)\n\nconst R = queue.Q + users.U\n");
    r.write("decks/tools/layers.json", "{\"layers\":{\"registry\":[\"queue\",\"users\"]},\"pure\":[]}\n");
    const pkg = { pkg: ["x", "y"] };
    expect(run(r.root, "go", ["src", "pkg/a.go", ...words(pkg)])).toStrictEqual({ status: 0, stdout: "" });
    expect(run(r.root, "go", ["src", "pkg/b.go", ...words(pkg)])).toStrictEqual({ status: 0, stdout: "" });
    expect(run(r.root, "go", ["src", "registry/x.go", ...words({ registry: ["queue"] })])).toStrictEqual({
      status: 1,
      stdout: "guard: package registry imports m/users: the record has no 'uses' from registry to users (allowed: queue)\n",
    });
  } finally {
    r.rm();
  }
}, 60000);

test("Layers Arg example 3: the TypeScript guard keys a directory by its first folder under src/", () => {
  const r = tmpRoot("morph-p30-ts-");
  try {
    r.write("src/units/convert.ts", "export const METRE = \"m\";\n");
    r.write("src/report/line.ts", "import { METRE } from \"../units/convert.js\";\n\nexport function lengthLine(label: string): string {\n  return label + \" \" + METRE;\n}\n");
    expect(run(r.root, "typescript", ["src", "src/report/line.ts", ...words({ "src/report": ["src/units"] })])).toStrictEqual({ status: 0, stdout: "" });
    expect(run(r.root, "typescript", ["src", "src/report/line.ts", ...words({ "src/report": [] })])).toStrictEqual({
      status: 1,
      stdout: "guard: src/report/line.ts:1 layer report imports layer units: the record has no 'uses' from report to units (allowed: none)\n",
    });
  } finally {
    r.rm();
  }
}, 60000);

test("Plan Layers example 1: no layers.json, nothing read", () => {
  const { record, map } = ts();
  expect(planLayers(record, map, false, "// guard\n", "typescript")).toStrictEqual({ ok: true, layers: null });
  const b = both();
  expect(planLayers(b.record, b.map, false, "// guard\n", "typescript")).toStrictEqual({ ok: true, layers: null });
});

test("Plan Layers example 2: an old guard is refused, a contract-2 guard gets the edges, a record error is the error", () => {
  const { record, map } = ts();
  expect(planLayers(record, map, true, "// guard\n", "typescript")).toStrictEqual({
    ok: false,
    error: "decks/tools/guard.mjs speaks contract 1: copy templates/typescript/decks/tools/guard.mjs from MorphV2",
  });
  expect(planLayers(record, map, true, "// morph-guard-contract: 2\n", "typescript")).toStrictEqual({
    ok: true,
    layers: { "src/report": ["src/units"], "src/units": [] },
  });
  const b = both();
  expect(planLayers(b.record, b.map, true, "// morph-guard-contract: 2\n", "typescript")).toStrictEqual({
    ok: false,
    error: "Function 'Read Config': 'uses: yaml' names the Component 'yaml' and the dependency 'yaml'",
  });
});

test("Plan Layers example 3: no code directory, the old guard is not refused", () => {
  const { record } = ts();
  const M = loadMap(JSON.stringify({ language: "typescript", cards: { "to-metres": { targets: ["docs/a.md"] }, "length-line": { targets: ["docs/b.md"] } } }), "morph-map.json");
  if (!M.ok) throw new Error(M.error);
  expect(planLayers(record, M.map, true, "// guard\n", "go")).toStrictEqual({ ok: true, layers: {} });
});

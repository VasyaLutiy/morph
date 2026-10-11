import { spawnSync } from "node:child_process";
import path from "node:path";
import { expect, test } from "vitest";
import { loadContour, loadMap } from "../../src/contour/load.js";
import { EMPTY_MAP } from "../../src/cli/planCommand.js";
import { GO, TYPESCRIPT } from "../../src/language/profiles.js";
import {
  layerEdges,
  cardLayers,
  layersArg,
  planLayers,
} from "../../src/rules/layers.js";
import { fixture, fixtureJson, fixturePath, tmpRoot } from "../helpers.js";

const ROOT = path.resolve(fixturePath("."), "..", "..");
const GUARD = (lang: string): string =>
  path.join(ROOT, "templates", lang, "decks", "tools", "guard.mjs");
const ENV = {
  ...process.env,
  GOFLAGS: "-mod=mod",
  GOPROXY: "off",
  GOTOOLCHAIN: "local",
  GOWORK: "off",
};
const run = (cwd: string, lang: string, args: string[]) =>
  spawnSync("node", [GUARD(lang), ...args], { cwd, encoding: "utf8", env: ENV });

test("Layer Edges example 1: Length Line uses units", () => {
  const ts = fixtureJson("ts-rename.json") as Record<string, string>;
  const R = loadContour(ts["contour.yaml"], "contour.yaml");
  const M = loadMap(ts["morph-map.json"], "morph-map.json");
  if (!R.ok || !M.ok) throw new Error("fixture");
  expect(layerEdges(R.record, M.map)).toStrictEqual({
    ok: true,
    edges: { "src/report": ["src/units"], "src/units": [] },
  });
});

test("Layer Edges example 2: the MorphStudio record agrees with the hand table", () => {
  const R = loadContour(fixture("rules/morphstudio/contour.yaml"), "contour.yaml");
  const M = loadMap(fixture("rules/morphstudio/morph-map.json"), "morph-map.json");
  if (!R.ok || !M.ok) throw new Error("fixture");
  const expected = fixtureJson("rules/morphstudio.edges.json");
  const result = layerEdges(R.record, M.map);
  expect(result).toStrictEqual({ ok: true, edges: expected });
  if (!result.ok) throw new Error("edges");
  const hand = fixtureJson("rules/morphstudio/layers.json") as {
    layers: Record<string, string[]>;
  };
  for (const key of Object.keys(result.edges)) {
    if (key === "users") continue;
    const allowed = hand.layers[key];
    for (const dir of result.edges[key]) {
      expect(allowed).toContain(dir);
    }
  }
});

test("Layer Edges example 3: the union record", () => {
  const R = loadContour(fixture("rules/union/contour.yaml"), "contour.yaml");
  const M = loadMap(fixture("rules/union/morph-map.json"), "morph-map.json");
  if (!R.ok || !M.ok) throw new Error("fixture");
  expect(layerEdges(R.record, M.map)).toStrictEqual({
    ok: true,
    edges: { gamma: ["pkg"], pkg: ["x", "y"], x: [], y: [] },
  });
});

test("Layer Edges example 4: a name that is both a Component and a dependency", () => {
  const R = loadContour(fixture("rules/both.yaml"), "both.yaml");
  if (!R.ok) throw new Error("fixture");
  expect(layerEdges(R.record, EMPTY_MAP)).toStrictEqual({
    ok: false,
    errors: [
      "Function 'Read Config': 'uses: yaml' names the Component 'yaml' and the dependency 'yaml'",
    ],
  });
});

test("Card Layers example 1: the layer entry of every code directory", () => {
  const E = fixtureJson("rules/morphstudio.edges.json") as Record<string, string[]>;
  expect(cardLayers(GO, ["users/registry.go"], E)).toStrictEqual({ users: [] });
  expect(cardLayers(GO, ["daemon/pump.go", "daemon/pump_test.go"], E)).toStrictEqual({
    daemon: E["daemon"],
  });
  expect(
    cardLayers(TYPESCRIPT, ["src/report/line.ts", "tests/report/line.test.ts"], {
      "src/report": ["src/units"],
      "src/units": [],
    }),
  ).toStrictEqual({ "src/report": ["src/units"] });
  expect(cardLayers(GO, ["new/a.go", "new/b.go", "main.go"], {})).toStrictEqual({
    new: [],
    ".": [],
  });
  expect(cardLayers(GO, ["users/registry_examples_test.go"], E)).toStrictEqual({});
});

test("Layers Arg example 1: the guard line arguments", () => {
  expect(layersArg([], undefined)).toBe("");
  expect(layersArg(["zod"], undefined)).toBe("");
  expect(layersArg([], { users: [] })).toBe(" '' '{\"users\":[]}'");
  expect(layersArg(["github.com/x/y"], { pkg: ["x", "y"], ".": [] })).toBe(
    " '{\"pkg\":[\"x\",\"y\"],\".\":[]}'",
  );
});

test("Layers Arg example 2: the Go guard reads the record's layers", () => {
  const r = tmpRoot();
  try {
    r.write("go.mod", "module m\n\ngo 1.22\n");
    r.write("x/x.go", "package x\n\nconst X = 1\n");
    r.write("y/y.go", "package y\n\nconst Y = 2\n");
    r.write("queue/q.go", "package queue\n\nconst Q = 3\n");
    r.write("users/u.go", "package users\n\nconst U = 4\n");
    r.write("pkg/a.go", "package pkg\n\nimport \"m/x\"\n\nconst A = x.X\n");
    r.write("pkg/b.go", "package pkg\n\nimport \"m/y\"\n\nconst B = y.Y\n");
    r.write(
      "registry/x.go",
      "package registry\n\nimport (\n\t\"m/queue\"\n\t\"m/users\"\n)\n\nconst R = queue.Q + users.U\n",
    );
    r.write(
      "decks/tools/layers.json",
      "{\"layers\":{\"registry\":[\"queue\",\"users\"]},\"pure\":[]}\n",
    );

    const L1 = { pkg: ["x", "y"] };
    const a = run(r.root, "go", ["src", "pkg/a.go", "", JSON.stringify(L1)]);
    expect(a.status).toBe(0);
    expect(a.stdout).toBe("");
    const b = run(r.root, "go", ["src", "pkg/b.go", "", JSON.stringify(L1)]);
    expect(b.status).toBe(0);
    expect(b.stdout).toBe("");

    const L2 = { registry: ["queue"] };
    const red = run(r.root, "go", ["src", "registry/x.go", "", JSON.stringify(L2)]);
    expect(red.status).toBe(1);
    expect(red.stdout).toBe(
      "guard: package registry imports m/users: the record has no 'uses' from registry to users (allowed: queue)\n",
    );
  } finally {
    r.rm();
  }
}, 60000);

test("Layers Arg example 3: the TypeScript guard reads the record's layers", () => {
  const r = tmpRoot();
  try {
    r.write("src/units/convert.ts", "export const METRE = \"m\";\n");
    r.write(
      "src/report/line.ts",
      "import { METRE } from \"../units/convert.js\";\n\nexport function lengthLine(label: string): string {\n  return label + \" \" + METRE;\n}\n",
    );

    const L1 = { "src/report": ["src/units"] };
    const green = run(r.root, "typescript", [
      "src",
      "src/report/line.ts",
      "",
      JSON.stringify(L1),
    ]);
    expect(green.status).toBe(0);
    expect(green.stdout).toBe("");

    const L2 = { "src/report": [] };
    const red = run(r.root, "typescript", [
      "src",
      "src/report/line.ts",
      "",
      JSON.stringify(L2),
    ]);
    expect(red.status).toBe(1);
    expect(red.stdout).toBe(
      "guard: src/report/line.ts:1 layer report imports layer units: the record has no 'uses' from report to units (allowed: none)\n",
    );
  } finally {
    r.rm();
  }
}, 60000);

test("Plan Layers example 1: without decks/tools/layers.json nothing changes", () => {
  const ts = fixtureJson("ts-rename.json") as Record<string, string>;
  const R = loadContour(ts["contour.yaml"], "contour.yaml");
  const M = loadMap(ts["morph-map.json"], "morph-map.json");
  const both = loadContour(fixture("rules/both.yaml"), "both.yaml");
  if (!R.ok || !M.ok || !both.ok) throw new Error("fixture");
  expect(planLayers(R.record, M.map, false, "// guard\n", "typescript")).toStrictEqual({
    ok: true,
    layers: null,
  });
  expect(planLayers(both.record, EMPTY_MAP, false, "// guard\n", "typescript")).toStrictEqual({
    ok: true,
    layers: null,
  });
});

test("Plan Layers example 2: the guard contract and the layer errors", () => {
  const ts = fixtureJson("ts-rename.json") as Record<string, string>;
  const R = loadContour(ts["contour.yaml"], "contour.yaml");
  const M = loadMap(ts["morph-map.json"], "morph-map.json");
  const both = loadContour(fixture("rules/both.yaml"), "both.yaml");
  if (!R.ok || !M.ok || !both.ok) throw new Error("fixture");
  expect(planLayers(R.record, M.map, true, "// guard\n", "typescript")).toStrictEqual({
    ok: false,
    error:
      "decks/tools/guard.mjs speaks contract 1: copy templates/typescript/decks/tools/guard.mjs from MorphV2",
  });
  expect(
    planLayers(R.record, M.map, true, "// morph-guard-contract: 2\n", "typescript"),
  ).toStrictEqual({
    ok: true,
    layers: { "src/report": ["src/units"], "src/units": [] },
  });
  expect(
    planLayers(both.record, EMPTY_MAP, true, "// morph-guard-contract: 2\n", "typescript"),
  ).toStrictEqual({
    ok: false,
    error:
      "Function 'Read Config': 'uses: yaml' names the Component 'yaml' and the dependency 'yaml'",
  });
});

test("Plan Layers example 3: no code target, so the old guard is not refused", () => {
  const ts = fixtureJson("ts-rename.json") as Record<string, string>;
  const R = loadContour(ts["contour.yaml"], "contour.yaml");
  const M = loadMap(
    JSON.stringify({
      language: "typescript",
      cards: {
        "to-metres": { targets: ["docs/a.md"] },
        "length-line": { targets: ["docs/b.md"] },
      },
    }),
    "m.json",
  );
  if (!R.ok || !M.ok) throw new Error("fixture");
  expect(planLayers(R.record, M.map, true, "// guard\n", "go")).toStrictEqual({
    ok: true,
    layers: {},
  });
});

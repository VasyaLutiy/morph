import { spawnSync } from "node:child_process";
import fs from "node:fs";
import path from "node:path";
import { expect, test } from "vitest";
import { blameLog } from "../../src/cards/transaction.js";
import { loadContour, loadMap } from "../../src/contour/load.js";
import { TREE_PROFILES } from "../../src/language/treeProfiles.js";
import { planSpec } from "../../src/planner/plan.js";
import { planRules } from "../../src/rules/guardrails.js";
import { layerEdges } from "../../src/rules/layers.js";
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

interface SingleCase {
  map: string;
  tree: Record<string, string>;
  file: string;
  card: string;
  records: Record<string, string>;
  beside: Record<string, string>;
  then: Record<string, { status: number; stdout: string }>;
}

test("Rules Arg example 6: the guard blames the importing file of the record", () => {
  // MorphStudio P9a run 2: the record is tests/fixtures/rules/p9a/contour.yaml with
  // tests/fixtures/rules/p9a/morph-map.json, and its tree comes from
  // tests/fixtures/rules/p9a/tree.json.
  const R = loadContour(fixture("rules/p9a/contour.yaml"), "contour.yaml");
  const M = loadMap(fixture("rules/p9a/morph-map.json"), "morph-map.json");
  if (!R.ok || !M.ok) throw new Error("fixture");
  const P = planRules(R.record, M.map, true, "// morph-guard-contract: 3\n", "go");
  if (!P.ok || P.layers === null || P.rules === null) throw new Error("plan");
  const T = fixtureJson("rules/p9a/tree.json") as {
    tree: Record<string, string>;
    forbidden: Record<string, string>;
    layersJson: string;
    owners: Record<string, string>;
  };
  const L = JSON.stringify(P.layers);
  const RR = JSON.stringify(P.rules);
  const files = ["users/registry.go", "users/secrets.go", "users/tokens.go"];
  const r = tmpRoot();
  try {
    for (const [p, text] of Object.entries(T.tree)) r.write(p, text);
    r.write("decks/tools/layers.json", T.layersJson);
    for (const f of files) {
      const res = run(r.root, "go", ["src", f, "", L, RR]);
      expect(res.status).toBe(0);
      expect(res.stdout).toBe("");
    }
    for (const [p, text] of Object.entries(T.forbidden)) r.write(p, text);
    const red = run(r.root, "go", ["src", "users/registry.go", "", L, RR]);
    expect(red.status).toBe(1);
    expect(red.stdout).toBe(
      "guard: users/registry.go:5: imports github.com/google/uuid: not a dependency the record gives this Component (allowed: the standard library)\n",
    );
    for (const f of ["users/secrets.go", "users/tokens.go"]) {
      const res = run(r.root, "go", ["src", f, "", L, RR]);
      expect(res.status).toBe(0);
      expect(res.stdout).toBe("");
    }
    const blame = blameLog(
      red.stdout,
      "user-registry",
      T.owners,
      TREE_PROFILES.map((t) => t.fileLine),
      () => true,
    );
    expect(blame).toStrictEqual({ cards: ["user-registry"], outside: [] });
  } finally {
    r.rm();
  }
}, 120000);

test("Rules Arg example 7: the users layer comes from the record", () => {
  const R = loadContour(fixture("rules/p9a/contour.yaml"), "contour.yaml");
  const M = loadMap(fixture("rules/p9a/morph-map.json"), "morph-map.json");
  if (!R.ok || !M.ok) throw new Error("fixture");
  const E = layerEdges(R.record, M.map);
  if (!E.ok) throw new Error("edges");
  expect(E.edges).toStrictEqual({ queue: [], registry: ["queue"], users: [] });
  const T = fixtureJson("rules/p9a/tree.json") as {
    tree: Record<string, string>;
    layersJson: string;
  };
  const L = JSON.stringify(E.edges);
  const r = tmpRoot();
  try {
    for (const [p, text] of Object.entries(T.tree)) r.write(p, text);
    r.write("decks/tools/layers.json", T.layersJson);
    for (const f of ["users/registry.go", "users/secrets.go", "users/tokens.go"]) {
      const res = run(r.root, "go", ["src", f, "", L, "{}"]);
      expect(res.status).toBe(0);
      expect(res.stdout).toBe("");
    }
  } finally {
    r.rm();
  }
}, 120000);

test("Plan Rules example 4: a Go record change alone changes the guard", () => {
  const C = fixtureJson("rules/single/cases.json") as { go: SingleCase };
  const c = C.go;
  const base = c.then.base;
  if (base === undefined) throw new Error("fixture: base");
  for (const K of Object.keys(c.records)) {
    const recordText = c.records[K];
    const expected = c.then[K];
    if (recordText === undefined || expected === undefined) throw new Error("fixture: " + K);
    if (K !== "base") {
      expect(expected).not.toStrictEqual(base);
    }
    const R = loadContour(recordText, "contour.yaml");
    const M = loadMap(c.map, "morph-map.json");
    if (!R.ok || !M.ok) throw new Error("fixture: " + K);
    const P = planRules(R.record, M.map, false, "// morph-guard-contract: 3\n", "go");
    if (!P.ok || P.layers === null || P.rules === null) throw new Error("plan: " + K);
    const S = planSpec({
      record: R.record,
      map: M.map,
      spec: "contour.yaml",
      components: ["app", "lib"],
      judge: false,
      hasFile: () => true,
    });
    if (!S.ok) throw new Error("spec: " + K);
    // the mods argument is S.uses["app-main"] joined by "," (the card's record dependencies)
    const mods = (S.uses[c.card] ?? []).join(",");
    const layers = JSON.stringify(P.layers);
    const rules = JSON.stringify(P.rules);
    for (const B of [null, ...Object.keys(c.beside)]) {
      const r = tmpRoot();
      try {
        for (const [p, text] of Object.entries(c.tree)) r.write(p, text);
        if (B !== null) {
          const besideText = c.beside[B];
          if (besideText === undefined) throw new Error("beside: " + B);
          r.write(B, besideText);
        }
        const res = run(r.root, "go", ["src", c.file, mods, layers, rules]);
        expect({ status: res.status, stdout: res.stdout }).toStrictEqual(expected);
      } finally {
        r.rm();
      }
    }
  }
}, 120000);

test("Plan Rules example 5: a TypeScript record change alone changes the guard", () => {
  const C = fixtureJson("rules/single/cases.json") as { typescript: SingleCase };
  const c = C.typescript;
  const base = c.then.base;
  if (base === undefined) throw new Error("fixture: base");
  for (const K of Object.keys(c.records)) {
    const recordText = c.records[K];
    const expected = c.then[K];
    if (recordText === undefined || expected === undefined) throw new Error("fixture: " + K);
    if (K !== "base") {
      expect(expected).not.toStrictEqual(base);
    }
    const R = loadContour(recordText, "contour.yaml");
    const M = loadMap(c.map, "morph-map.json");
    if (!R.ok || !M.ok) throw new Error("fixture: " + K);
    const P = planRules(R.record, M.map, false, "// morph-guard-contract: 3\n", "typescript");
    if (!P.ok || P.layers === null || P.rules === null) throw new Error("plan: " + K);
    const S = planSpec({
      record: R.record,
      map: M.map,
      spec: "contour.yaml",
      components: ["app", "lib"],
      judge: false,
      hasFile: () => true,
    });
    if (!S.ok) throw new Error("spec: " + K);
    // the mods argument is S.uses["app-main"] joined by "," (the card's record dependencies)
    const mods = (S.uses[c.card] ?? []).join(",");
    const layers = JSON.stringify(P.layers);
    const rules = JSON.stringify(P.rules);
    for (const B of [null, ...Object.keys(c.beside)]) {
      const r = tmpRoot();
      try {
        for (const [p, text] of Object.entries(c.tree)) r.write(p, text);
        if (B !== null) {
          const besideText = c.beside[B];
          if (besideText === undefined) throw new Error("beside: " + B);
          r.write(B, besideText);
        }
        fs.symlinkSync(path.join(ROOT, "node_modules"), r.path("node_modules"));
        const res = run(r.root, "typescript", ["src", c.file, mods, layers, rules]);
        expect({ status: res.status, stdout: res.stdout }).toStrictEqual(expected);
      } finally {
        r.rm();
      }
    }
  }
}, 120000);

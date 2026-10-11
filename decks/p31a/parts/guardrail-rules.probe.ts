// P31a probe for guardrail-rules by docs/TASK_P31a_guardrails.md §2.2 (src/rules/guardrails.ts) — issues #42, #46:
// canonical Guardrails → rule ids per code directory; the guard's contract line decides what is emitted. Record
// Guardrail Rules 1-4, Card Rules 1, Rules Arg 1, 4, 5, Guard Contract 1, Plan Rules 1-3 (Rules Arg 2-3 test the
// template guards alone, no code of this card: the judge's).
import { test, expect } from "vitest";
import { spawnSync } from "node:child_process";
import fs from "node:fs";
import path from "node:path";
import { cardRules, guardContract, guardrailRules, planRules, rulesArg } from "../../src/rules/guardrails.js";
import { layerEdges } from "../../src/rules/layers.js";
import { loadContour, loadMap } from "../../src/contour/load.js";
import { EMPTY_MAP } from "../../src/cli/planCommand.js";
import { GO, TYPESCRIPT } from "../../src/language/profiles.js";
import { fixture, fixtureJson, fixturePath, tmpRoot } from "../../tests/helpers.js";
import type { ContourMap, ContourRecord } from "../../src/contour/types.js";

const rec = (text: string, name: string): ContourRecord => {
  const R = loadContour(text, name);
  if (!R.ok) throw new Error("fixture " + name);
  return R.record;
};
const mp = (text: string, name: string): ContourMap => {
  const M = loadMap(text, name);
  if (!M.ok) throw new Error("fixture " + name);
  return M.map;
};
const dir = (d: string): [ContourRecord, ContourMap] =>
  [rec(fixture(d + "/contour.yaml"), "contour.yaml"), mp(fixture(d + "/morph-map.json"), "morph-map.json")];
const ROOT = path.resolve(fixturePath("."), "..", "..");
const GUARD = (lang: string): string => path.join(ROOT, "templates", lang, "decks", "tools", "guard.mjs");
const ENV = { ...process.env, GOFLAGS: "-mod=mod", GOPROXY: "off", GOTOOLCHAIN: "local", GOWORK: "off" };
const P = (c: string): string => "Guardrail 'Pure' of Component " + c;
const RG = { app: {}, calc: { pure: P("calc") }, clock: { pure: P("clock") }, shell: { pure: P("shell") } };
const RT_ORDERS = {
  "no-clock": "Guardrail 'no  CLOCK' of Component orders",
  "no-env": "Guardrail 'No Env' of Interface orders API",
  "no-network": "Guardrail 'No Network' of System guarded",
  "no-process": "Guardrail 'No Process' of Interface cancel hook",
  "no-shell": "Guardrail 'No Shell' of Function Place Order",
  pure: "Guardrail 'Pure' of Function Cancel Order",
};
const S46 = "Guardrail 'No Shell' of System issue46";
const R46 = { daemon: { "no-shell": S46 }, runner: { "no-shell": S46 } };

test("Guardrail Rules example 1: the Go parity record", () => {
  const [R, M] = dir("rules/parity/go");
  expect(guardrailRules(R, M)).toStrictEqual({ ok: true, rules: RG, proseOnly: [] });
});

test("Guardrail Rules example 2: the TypeScript parity record", () => {
  const [R, M] = dir("rules/parity/typescript");
  expect(guardrailRules(R, M)).toStrictEqual({ ok: true, rules: {
    "src/app": { "no-process": "Guardrail 'No Process' of Component app" }, "src/clock": { pure: P("clock") },
    "src/core": { pure: P("core") }, "src/main": {}, "src/net": { pure: P("net") },
    "src/util": { "no-process": "Guardrail 'No Process' of Component util" } }, proseOnly: [] });
});

test("Guardrail Rules example 3: inherited from every place, the most specific first; unknown names prose", () => {
  const r = guardrailRules(rec(fixture("rules/guarded.yaml"), "guarded.yaml"), EMPTY_MAP);
  expect(r).toStrictEqual({ ok: true, rules: {
    catalog: { "no-network": "Guardrail 'No Network' of System guarded", "stdlib-only": "Guardrail 'Stdlib Only' of Component catalog" },
    "src/orders": RT_ORDERS }, proseOnly: ["Interfaces Share One Core", "Frozen Tree During Run", "Missing Rule", "No Process"] });
  if (r.ok) expect(Object.keys(r.rules["src/orders"])).toStrictEqual(["no-clock", "no-env", "no-network", "no-process", "no-shell", "pure"]);
});

test("Guardrail Rules example 4: an unknown language is an error", () => {
  expect(guardrailRules(rec(fixture("rules/badLanguage.yaml"), "badLanguage.yaml"), EMPTY_MAP)).toStrictEqual({
    ok: false, errors: ["Component 'legacy': unknown language 'cobol' (known: typescript, python, go)"] });
});

test("Card Rules example 1: a card's code directories", () => {
  expect(cardRules(GO, ["calc/add.go", "calc/add_test.go"], RG)).toStrictEqual({ calc: RG.calc });
  expect(cardRules(TYPESCRIPT, ["src/orders/placeOrder.ts", "tests/orders/placeOrder.test.ts"], { "src/orders": RT_ORDERS })).toStrictEqual({ "src/orders": RT_ORDERS });
  const fresh = cardRules(GO, ["new/a.go", "new/b.go", "main.go"], {});
  expect(fresh).toStrictEqual({ new: {}, ".": {} });
  expect(Object.keys(fresh)).toStrictEqual(["new", "."]);
  expect(cardRules(GO, ["calc/add_examples_test.go"], RG)).toStrictEqual({});
});

test("Rules Arg example 1: the argument, each quote escaped", () => {
  expect(rulesArg(undefined)).toBe("");
  expect(rulesArg({})).toBe(" '{}'");
  expect(rulesArg({ calc: { pure: P("calc") } })).toBe(" '{\"calc\":{\"pure\":\"Guardrail \\u0027Pure\\u0027 of Component calc\"}}'");
});

test("Rules Arg example 4: old file-driven and new record-driven guards agree per file", () => {
  const trees = fixtureJson("rules/parity/trees.json") as Record<string, Record<string, string>>;
  const files: Record<string, string[]> = {
    go: ["calc/add.go", "clock/now.go", "shell/run.go", "app/app.go"],
    typescript: ["src/core/add.ts", "src/clock/now.ts", "src/net/page.ts", "src/app/run.ts", "src/util/pad.ts", "src/main/cli.ts"],
  };
  const want: Record<string, number[]> = { go: [0, 1, 1, 0], typescript: [0, 1, 1, 1, 0, 0] };
  for (const lang of ["go", "typescript"]) {
    const [R, M] = dir("rules/parity/" + lang);
    const edges = layerEdges(R, M);
    const rules = guardrailRules(R, M);
    if (!edges.ok || !rules.ok) throw new Error("parity " + lang);
    const r = tmpRoot();
    try {
      for (const [f, text] of Object.entries(trees[lang])) r.write(f, text);
      r.write("old-guard.mjs", fixture("rules/guard2/" + lang + ".guard.txt"));
      fs.symlinkSync(path.join(ROOT, "node_modules"), r.path("node_modules"));
      const olds = files[lang].map((f) => spawnSync("node", [r.path("old-guard.mjs"), "src", f], { cwd: r.root, encoding: "utf8", env: ENV }).status);
      const news = files[lang].map((f) => spawnSync("node", [GUARD(lang), "src", f, "", JSON.stringify(edges.edges), JSON.stringify(rules.rules)], { cwd: r.root, encoding: "utf8", env: ENV }).status);
      expect(olds).toStrictEqual(want[lang]);
      expect(news).toStrictEqual(want[lang]);
    } finally {
      r.rm();
    }
  }
});

test("Rules Arg example 5: issue #46, a missing edge red in every state of layers.json", () => {
  const fx = fixtureJson("rules/issue46/tree.json") as { tree: Record<string, string>; layersJson: Record<string, string> };
  const [R, M] = dir("rules/issue46");
  const planned = planRules(R, M, false, "// morph-guard-contract: 3\n", "go");
  if (!planned.ok) throw new Error("planRules");
  for (const state of ["with layers", "layers key removed", "deleted"]) {
    const r = tmpRoot();
    try {
      for (const [f, text] of Object.entries(fx.tree)) r.write(f, text);
      if (state !== "deleted") r.write("decks/tools/layers.json", fx.layersJson[state]);
      const red = spawnSync("node", [GUARD("go"), "src", "daemon/daemon.go", "", JSON.stringify(planned.layers), JSON.stringify(planned.rules)], { cwd: r.root, encoding: "utf8", env: ENV });
      expect(red.status).toBe(1);
      expect(red.stdout).toBe("guard: package daemon imports m/runner: the record has no 'uses' from daemon to runner (allowed: none)\n");
      const bare = spawnSync("node", [GUARD("go"), "src", "daemon/daemon.go"], { cwd: r.root, encoding: "utf8", env: ENV });
      expect(bare.status).toBe(1);
      expect(bare.stdout).toBe("guard: no layer edges given — re-cut with morph plan\n");
    } finally {
      r.rm();
    }
  }
});

test("Guard Contract example 1: the first contract line, else 0", () => {
  expect(guardContract("// guard\n")).toBe(0);
  expect(guardContract("// morph-guard-contract: 2\n")).toBe(2);
  expect(guardContract("x\n// morph-guard-contract: 3\n// morph-guard-contract: 2\n")).toBe(3);
  expect(guardContract("// morph-guard-contract: x\n")).toBe(0);
});

const tsRename = (): [ContourRecord, ContourMap] => {
  const ts = fixtureJson("ts-rename.json") as Record<string, string>;
  return [rec(ts["contour.yaml"], "contour.yaml"), mp(ts["morph-map.json"], "morph-map.json")];
};
const EDGES = { "src/report": ["src/units"], "src/units": [] };

test("Plan Rules example 1: a hand guard gets nothing; an old copy beside layers.json is refused", () => {
  const [R, M] = tsRename();
  expect(planRules(R, M, false, "// guard\n", "typescript")).toStrictEqual({ ok: true, layers: null, rules: null, proseOnly: [] });
  expect(planRules(R, M, true, "// guard\n", "typescript")).toStrictEqual({ ok: false, error: "decks/tools/guard.mjs speaks contract 1: copy templates/typescript/decks/tools/guard.mjs from MorphV2" });
});

test("Plan Rules example 2: the contract line, not layers.json, decides", () => {
  const [R, M] = tsRename();
  expect(planRules(R, M, false, "// morph-guard-contract: 2\n", "typescript")).toStrictEqual({ ok: true, layers: EDGES, rules: null, proseOnly: [] });
  const three = { ok: true, layers: EDGES, rules: { "src/report": {}, "src/units": {} }, proseOnly: [] };
  expect(planRules(R, M, false, "// morph-guard-contract: 3\n", "typescript")).toStrictEqual(three);
  expect(planRules(R, M, true, "// morph-guard-contract: 3\n", "typescript")).toStrictEqual(three);
});

test("Plan Rules example 3: issue #46's record; an older guard with rules refused", () => {
  const [R, M] = dir("rules/issue46");
  const want = { ok: true, layers: { daemon: [], runner: [] }, rules: R46, proseOnly: [] };
  expect(planRules(R, M, true, "// morph-guard-contract: 3\n", "go")).toStrictEqual(want);
  expect(planRules(R, M, false, "// morph-guard-contract: 3\n", "go")).toStrictEqual(want);
  expect(planRules(R, M, false, "// morph-guard-contract: 2\n", "go")).toStrictEqual({ ok: false, error: "decks/tools/guard.mjs speaks contract 2: copy templates/go/decks/tools/guard.mjs from MorphV2" });
  expect(planRules(R, M, true, "// guard\n", "go")).toStrictEqual({ ok: false, error: "decks/tools/guard.mjs speaks contract 1: copy templates/go/decks/tools/guard.mjs from MorphV2" });
});

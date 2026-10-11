// P31c probe for guardrail-rules by docs/TASK_P31c_scope.md §2.2 (src/rules/guardrails.ts) — issue #42 ledger item 9:
// a Function or Interface Guardrail binds only its card's code files. Starts from P31a's probe: changed Guardrail
// Rules 3, Card Rules 1 (and Rules Arg 5's red line, changed by P31b's guard); new Guardrail Rules 5, Card Rules 2,
// Rules Arg 8. Unchanged rows: Guardrail Rules 1, 2, 4, Rules Arg 1, 4, 5, Guard Contract 1, Plan Rules 1-3.
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
const RT = {
  "src/orders": {
    "no-clock": "Guardrail 'no  CLOCK' of Component orders",
    "no-network": "Guardrail 'No Network' of System guarded",
  },
  "src/orders/cancelOrder.ts": {
    "no-process": "Guardrail 'No Process' of Interface cancel hook",
    pure: "Guardrail 'Pure' of Function Cancel Order",
  },
  "src/orders/ordersApi.ts": { "no-env": "Guardrail 'No Env' of Interface orders API" },
  "src/orders/placeOrder.ts": { "no-shell": "Guardrail 'No Shell' of Function Place Order" },
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

test("Guardrail Rules example 3: Function and Interface rules keyed by their card's code file", () => {
  const r = guardrailRules(rec(fixture("rules/guarded.yaml"), "guarded.yaml"), EMPTY_MAP);
  expect(r).toStrictEqual({ ok: true, rules: {
    catalog: { "no-network": "Guardrail 'No Network' of System guarded", "stdlib-only": "Guardrail 'Stdlib Only' of Component catalog" },
    ...RT }, proseOnly: ["Interfaces Share One Core", "Frozen Tree During Run", "Missing Rule", "No Process"] });
  if (r.ok) expect(Object.keys(r.rules)).toStrictEqual(["catalog", "src/orders", "src/orders/cancelOrder.ts", "src/orders/ordersApi.ts", "src/orders/placeOrder.ts"]);
});

test("Guardrail Rules example 4: an unknown language is an error", () => {
  expect(guardrailRules(rec(fixture("rules/badLanguage.yaml"), "badLanguage.yaml"), EMPTY_MAP)).toStrictEqual({
    ok: false, errors: ["Component 'legacy': unknown language 'cobol' (known: typescript, python, go)"] });
});

test("Card Rules example 1: a card's code directories", () => {
  expect(cardRules(GO, ["calc/add.go", "calc/add_test.go"], RG)).toStrictEqual({ calc: RG.calc });
  const placed = cardRules(TYPESCRIPT, ["src/orders/placeOrder.ts", "tests/orders/placeOrder.test.ts"], RT);
  expect(placed).toStrictEqual({ "src/orders": { ...RT["src/orders"], "no-shell": "Guardrail 'No Shell' of Function Place Order" } });
  expect(Object.keys(placed["src/orders"])).toStrictEqual(["no-clock", "no-network", "no-shell"]);
  const fresh = cardRules(GO, ["new/a.go", "new/b.go", "main.go"], {});
  expect(fresh).toStrictEqual({ new: {}, ".": {} });
  expect(Object.keys(fresh)).toStrictEqual(["new", "."]);
  expect(cardRules(GO, ["calc/add_examples_test.go"], RG)).toStrictEqual({});
});

test("Card Rules example 2: a card's file rules fold into its directory, the file's first; a sibling's file adds nothing", () => {
  const F = { d: { "no-env": "S", "no-clock": "C" }, "d/a.go": { "no-clock": "F" }, "d/b.go": { "no-shell": "G" }, "d/x.go": { pure: "X" }, "e/c.go": { "no-env": "H" } };
  const two = cardRules(GO, ["d/a.go", "d/b.go", "e/c.go", "d/a_test.go"], F);
  expect(two).toStrictEqual({ d: { "no-clock": "F", "no-env": "S", "no-shell": "G" }, e: { "no-env": "H" } });
  expect(Object.keys(two)).toStrictEqual(["d", "e"]);
  expect(Object.keys(two["d"])).toStrictEqual(["no-clock", "no-env", "no-shell"]);
  expect(cardRules(GO, ["d/x.go"], F)).toStrictEqual({ d: { "no-clock": "C", "no-env": "S", pure: "X" } });
  expect(cardRules(GO, ["e/c.go"], { "e/c.go": { "no-env": "H" } })).toStrictEqual({ e: { "no-env": "H" } });
});

interface ScopeCase { map: string; tree: Record<string, string>; files: Record<string, string>; records: Record<string, string>; then: Record<string, Record<string, { status: number; stdout: string }>> }
const SCOPE = (): Record<string, ScopeCase> => fixtureJson("rules/scope/cases.json") as Record<string, ScopeCase>;

test("Guardrail Rules example 5: the scope record, a file key only for a Function or Interface rule", () => {
  const S = SCOPE();
  const g = (lang: string, k: string) => guardrailRules(rec(S[lang].records[k], "contour.yaml"), mp(S[lang].map, "morph-map.json"));
  expect(g("go", "function")).toStrictEqual({ ok: true, rules: { report: {}, "report/stamp.go": { "no-clock": "Guardrail 'No Clock' of Function Stamp Line" }, units: {} }, proseOnly: [] });
  expect(g("typescript", "interface")).toStrictEqual({ ok: true, rules: { "src/report": {}, "src/report/stamp.ts": { "no-clock": "Guardrail 'No Clock' of Interface stamp hook" }, "src/units": {} }, proseOnly: [] });
  expect(g("typescript", "component")).toStrictEqual({ ok: true, rules: { "src/report": { "no-clock": "Guardrail 'No Clock' of Component report" }, "src/units": {} }, proseOnly: [] });
});

test("Rules Arg example 8: a Function rule reds only its card's file; Component its directory; System all", () => {
  const S = SCOPE();
  for (const lang of ["go", "typescript"]) {
    const M = mp(S[lang].map, "morph-map.json");
    for (const k of Object.keys(S[lang].records)) {
      const P = planRules(rec(S[lang].records[k], "contour.yaml"), M, false, "// morph-guard-contract: 3\n", lang);
      if (!P.ok || P.layers === null || P.rules === null) throw new Error("planRules " + lang + " " + k);
      for (const [file, card] of Object.entries(S[lang].files)) {
        const targets = M.cards.find((c) => c.id === card)?.targets ?? [];
        const rules = cardRules(lang === "go" ? GO : TYPESCRIPT, targets, P.rules);
        const r = tmpRoot();
        try {
          for (const [f, text] of Object.entries(S[lang].tree)) r.write(f, text);
          if (lang === "typescript") fs.symlinkSync(path.join(ROOT, "node_modules"), r.path("node_modules"));
          const out = spawnSync("node", [GUARD(lang), "src", file, "", JSON.stringify(P.layers), JSON.stringify(rules)], { cwd: r.root, encoding: "utf8", env: ENV });
          expect({ lang, k, file, status: out.status, stdout: out.stdout }).toStrictEqual({ lang, k, file, ...S[lang].then[k][file] });
        } finally {
          r.rm();
        }
      }
    }
  }
}, 240000);

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
}, 120000);

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
      expect(red.stdout).toBe("guard: daemon/daemon.go:3: imports m/runner: the record has no 'uses' from daemon to runner (allowed: none)\n");
      const bare = spawnSync("node", [GUARD("go"), "src", "daemon/daemon.go"], { cwd: r.root, encoding: "utf8", env: ENV });
      expect(bare.status).toBe(1);
      expect(bare.stdout).toBe("guard: no layer edges given — re-cut with morph plan\n");
    } finally {
      r.rm();
    }
  }
}, 120000);

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

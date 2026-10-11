import { spawnSync } from "node:child_process";
import fs from "node:fs";
import path from "node:path";
import { expect, test } from "vitest";
import { loadContour, loadMap } from "../../src/contour/load.js";
import { GO, TYPESCRIPT } from "../../src/language/profiles.js";
import {
  cardRules,
  guardrailRules,
  planRules,
} from "../../src/rules/guardrails.js";
import { fixtureJson, fixturePath, tmpRoot } from "../helpers.js";

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

interface ScopeLanguage {
  map: string;
  tree: Record<string, string>;
  files: Record<string, string>;
  records: Record<string, string>;
  then: Record<string, Record<string, { status: number; stdout: string }>>;
}

interface ScopeCases {
  go: ScopeLanguage;
  typescript: ScopeLanguage;
}

function need<T>(value: T | undefined): T {
  if (value === undefined) throw new Error("fixture");
  return value;
}

test("Guardrail Rules example 5: a Function or an Interface rule binds only its card's file", () => {
  const S = fixtureJson("rules/scope/cases.json") as ScopeCases;

  const RGo = loadContour(need(S.go.records["function"]), "contour.yaml");
  const MGo = loadMap(S.go.map, "morph-map.json");
  if (!RGo.ok || !MGo.ok) throw new Error("fixture");
  expect(guardrailRules(RGo.record, MGo.map)).toStrictEqual({
    ok: true,
    rules: {
      report: {},
      "report/stamp.go": { "no-clock": "Guardrail 'No Clock' of Function Stamp Line" },
      units: {},
    },
    proseOnly: [],
  });

  const RIf = loadContour(need(S.typescript.records["interface"]), "contour.yaml");
  const MIf = loadMap(S.typescript.map, "morph-map.json");
  if (!RIf.ok || !MIf.ok) throw new Error("fixture");
  expect(guardrailRules(RIf.record, MIf.map)).toStrictEqual({
    ok: true,
    rules: {
      "src/report": {},
      "src/report/stamp.ts": { "no-clock": "Guardrail 'No Clock' of Interface stamp hook" },
      "src/units": {},
    },
    proseOnly: [],
  });

  const RCp = loadContour(need(S.typescript.records["component"]), "contour.yaml");
  const MCp = loadMap(S.typescript.map, "morph-map.json");
  if (!RCp.ok || !MCp.ok) throw new Error("fixture");
  expect(guardrailRules(RCp.record, MCp.map)).toStrictEqual({
    ok: true,
    rules: {
      "src/report": { "no-clock": "Guardrail 'No Clock' of Component report" },
      "src/units": {},
    },
    proseOnly: [],
  });
});

test("Card Rules example 2: a card's own files win over its directory", () => {
  const F = {
    d: { "no-env": "S", "no-clock": "C" },
    "d/a.go": { "no-clock": "F" },
    "d/b.go": { "no-shell": "G" },
    "d/x.go": { pure: "X" },
    "e/c.go": { "no-env": "H" },
  };

  const first = cardRules(GO, ["d/a.go", "d/b.go", "e/c.go", "d/a_test.go"], F);
  expect(first).toStrictEqual({
    d: { "no-clock": "F", "no-env": "S", "no-shell": "G" },
    e: { "no-env": "H" },
  });
  expect(Object.keys(first)).toStrictEqual(["d", "e"]);

  expect(cardRules(GO, ["d/x.go"], F)).toStrictEqual({
    d: { "no-clock": "C", "no-env": "S", pure: "X" },
  });

  expect(cardRules(GO, ["e/c.go"], { "e/c.go": { "no-env": "H" } })).toStrictEqual({
    e: { "no-env": "H" },
  });
});

test("Rules Arg example 8: a Function or an Interface Guardrail reds only its card's file", () => {
  const S = fixtureJson("rules/scope/cases.json") as ScopeCases;
  const keys = ["function", "interface", "component", "system"] as const;
  for (const L of ["go", "typescript"] as const) {
    const lang = S[L];
    const profile = L === "go" ? GO : TYPESCRIPT;
    for (const K of keys) {
      const R = loadContour(need(lang.records[K]), "contour.yaml");
      const M = loadMap(lang.map, "morph-map.json");
      if (!R.ok || !M.ok) throw new Error("fixture");
      const P = planRules(R.record, M.map, false, "// morph-guard-contract: 3\n", L);
      if (!P.ok || P.layers === null || P.rules === null) throw new Error("plan");
      const want = need(lang.then[K]);
      for (const [file, card] of Object.entries(lang.files)) {
        const targets = M.map.cards.find((c) => c.id === card)?.targets ?? [];
        const rules = cardRules(profile, targets, P.rules);
        const r = tmpRoot();
        try {
          for (const [p, text] of Object.entries(lang.tree)) r.write(p, text);
          if (L === "typescript") {
            fs.symlinkSync(path.join(ROOT, "node_modules"), r.path("node_modules"));
          }
          const res = spawnSync(
            "node",
            [GUARD(L), "src", file, "", JSON.stringify(P.layers), JSON.stringify(rules)],
            { cwd: r.root, encoding: "utf8", env: ENV },
          );
          expect({ status: res.status, stdout: res.stdout }).toStrictEqual(need(want[file]));
        } finally {
          r.rm();
        }
      }
    }
  }
}, 240000);

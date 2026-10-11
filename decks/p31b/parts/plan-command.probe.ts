// P31b probe for plan-command by docs/TASK_P31b_imports.md §2.2 (src/cli/planCommand.ts) — issue #42 Must hold 3,
// ledger 3: with --checks the document's warnings end with rules' Plan Notes. Record Plan Command example 20
// (tests/fixtures/cli/examples.json).
import { test, expect } from "vitest";
import fs from "node:fs";
import { planCommand } from "../../src/cli/planCommand.js";
import { fixture, tmpRoot } from "../../tests/helpers.js";
import type { PlanArgs, PlanDocument } from "../../src/cli/types.js";

const MINI = ["morph-map.json", "go.mod", "internal/testhelp/testhelp.go", "decks/m1/checks.json",
  "decks/m1/parts/_clamp-value_probe_test.go", "decks/m1/parts/_percent-of_probe_test.go", "decks/m1/parts/_format-share_probe_test.go"];
const args: PlanArgs = {
  name: "plan", root: ".", pretty: false, spec: "contour.yaml", components: ["calc", "report"], map: "morph-map.json",
  judge: true, out: null, checks: "decks/m1/checks.json",
};
const W = [
  "calc/Clamp Value: step produces 'int' names no Data Object or Event of the record",
  "calc/Percent Of: step produces 'int' names no Data Object or Event of the record",
  "report/Format Share: step produces 'string' names no Data Object or Event of the record",
];
type Doc = PlanDocument & { warnings?: string[] };
const LAYERS = "decks/tools/layers.json is not read: the record is the source; delete it";
const CLAMP = "clamp-value: checks.json extra 'imports' checks calc against a hand list; the record's rules and dependencies already govern imports per file: remove it";

test("Plan Command example 20: the notes of a layers.json and of an imports extra come last; a hand guard gets none", () => {
  const r = tmpRoot();
  try {
    for (const f of MINI) r.write(f, fixture("go-mini/" + f));
    r.write("contour.yaml", fixture("cli/goMiniGuarded.yaml"));
    r.write("decks/tools/firstdiff.mjs", "// firstdiff\n");
    r.write("decks/tools/guard.mjs", "// morph-guard-contract: 3\n");
    r.write("decks/m1/checks.json", fixture("cli/goMini.imports.checks.json"));
    r.write("decks/tools/layers.json", "{}\n");
    const a = planCommand(r.root, args);
    expect(a.code).toBe(0);
    expect((a.document as Doc).warnings).toStrictEqual([...W, LAYERS, CLAMP]);
    const b = planCommand(r.root, { ...args, only: ["percent-of", "format-share"] });
    expect(b.code).toBe(0);
    expect((b.document as Doc).warnings).toStrictEqual([...W, LAYERS]);
    fs.rmSync(r.path("decks/tools/layers.json"));
    r.write("decks/tools/guard.mjs", "// guard\n");
    const c = planCommand(r.root, args);
    expect(c.code).toBe(0);
    expect((c.document as Doc).warnings).toStrictEqual(W);
    r.write("decks/tools/guard.mjs", "// morph-guard-contract: 3\n");
    r.write("decks/m1/checks.json", fixture("go-mini/decks/m1/checks.json"));
    const d = planCommand(r.root, args);
    expect(d.code).toBe(0);
    expect((d.document as Doc).warnings).toStrictEqual(W);
  } finally {
    r.rm();
  }
});

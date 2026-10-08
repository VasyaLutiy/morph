// P15 probe for plan-command by docs/TASK_P15_golang.md §2.2 (src/cli/planCommand.ts, src/cli/readPlanChecks.ts) — the
// profile of --checks from the first selected Component's language (else the map's), the probe file by that profile.
// Record Plan Command example 9, then the §2.2 rows.
import fs from "node:fs";
import path from "node:path";
import { test, expect } from "vitest";
import { planCommand } from "../../src/cli/planCommand.js";
import { readPlanChecks } from "../../src/cli/readPlanChecks.js";
import { GO, TYPESCRIPT } from "../../src/language/profiles.js";
import type { PlanArgs, PlanDocument } from "../../src/cli/types.js";
import { fixture, tmpRoot } from "../../tests/helpers.js";
import type { TmpRoot } from "../../tests/helpers.js";

// the heredoc tags, never written whole in a probe (the builder refuses a probe that holds one)
const PROBE = ["MORPH", "PROBE", "EOF"].join("_");

const MINI = ["contour.yaml", "morph-map.json", "go.mod", "internal/testhelp/testhelp.go", "decks/m1/checks.json",
  "decks/m1/parts/_clamp-value_probe_test.go", "decks/m1/parts/_percent-of_probe_test.go", "decks/m1/parts/_format-share_probe_test.go"];
function miniRoot(): TmpRoot {
  const r = tmpRoot();
  for (const f of MINI) r.write(f, fixture("go-mini/" + f));
  r.write("decks/tools/guard.mjs", "// guard\n");
  r.write("decks/tools/firstdiff.mjs", "// firstdiff\n");
  return r;
}
const args = (over: Partial<PlanArgs>): PlanArgs => ({ name: "plan", root: ".", pretty: false, spec: "contour.yaml",
  components: ["calc", "report"], map: "morph-map.json", judge: true, out: "decks/m1/deck.json", checks: "decks/m1/checks.json", ...over });
const GENS = [["clamp-value"], ["clamp-value-judge", "percent-of"], ["format-share", "percent-of-judge"], ["format-share-judge"]];

test("Plan Command example 9: the go-mini cut with Go acceptances, by the Component's language and by the map's", () => {
  const r = miniRoot();
  try {
    const want = fixture("cli/goMini.deck.json");
    const a = planCommand(r.root, args({}));
    if (a.code !== 0) throw new Error("expected code 0: " + JSON.stringify(a.document).slice(0, 300));
    const doc = a.document as PlanDocument;
    expect(doc.components).toStrictEqual(["calc", "report"]);
    expect(doc.generations).toStrictEqual(GENS);
    expect(doc.cards).toStrictEqual(JSON.parse(want));
    expect(r.read("decks/m1/deck.json")).toBe(want);
    r.write("contour.yaml", r.read("contour.yaml").split("      language: go\n").join(""));
    r.write("morph-map.json", JSON.stringify({ language: "go", ...JSON.parse(r.read("morph-map.json")) }, null, 2) + "\n");
    const b = planCommand(r.root, args({ out: "decks/m1/deck2.json" }));
    expect(b.code).toBe(0);
    expect(r.read("decks/m1/deck2.json")).toBe(want);
  } finally {
    r.rm();
  }
});

test("rows: one Component alone, a missing Go probe, the probe read by profile, typescript by default", () => {
  const r = miniRoot();
  try {
    r.write("decks/m1/one.json", JSON.stringify({ phase: "m1", cards: [{ id: "format-share" }] }) + "\n");
    const one = planCommand(r.root, args({ components: ["report"], judge: false, out: null, checks: "decks/m1/one.json" }));
    if (one.code !== 0) throw new Error("expected code 0: " + JSON.stringify(one.document).slice(0, 300));
    const share = (one.document as PlanDocument).cards.find((c) => c.customId === "format-share");
    expect(share?.acceptance?.includes("echo '== probe'; cat > report/format-share_probe_test.go <<'" + PROBE + "'\n" +
      fixture("go-mini/decks/m1/parts/_format-share_probe_test.go"))).toBe(true);
    const record = r.read("contour.yaml");
    r.write("contour.yaml", record.replace("One text line over calc, package report in report/; imports mini/calc, no I/O.\n      language: go\n",
      "One text line over calc, package report in report/; imports mini/calc, no I/O.\n"));
    r.write("decks/m1/c.json", JSON.stringify({ phase: "m1", cards: [{ id: "clamp-value" }] }) + "\n");
    const first = planCommand(r.root, args({ judge: false, out: null, checks: "decks/m1/c.json" }));
    if (first.code !== 0) throw new Error("the first Component's language (go) builds clamp-value: " + JSON.stringify(first.document).slice(0, 300));
    const clamp = (first.document as PlanDocument).cards.find((c) => c.customId === "clamp-value");
    expect(clamp?.acceptance?.includes("echo '== build'; go build -overlay $P/overlay.json ./calc\n")).toBe(true);
    r.write("contour.yaml", record);
    fs.rmSync(path.join(r.root, "decks/m1/parts/_percent-of_probe_test.go"));
    r.write("decks/m1/parts/percent-of.probe.ts", "// a typescript probe is not the go card's\n");
    const gone = planCommand(r.root, args({ out: "decks/m1/x.json" }));
    expect(gone).toStrictEqual({ code: 2, document: { error: { code: 2, kind: "DeckError",
      message: "acceptances not built (1 error):\ncode card 'percent-of' has no probe" } } });
    expect(r.exists("decks/m1/x.json")).toBe(false);
    r.write("decks/k/checks.json", JSON.stringify({ phase: "k", cards: [{ id: "a" }, { id: "b" }] }) + "\n");
    r.write("decks/k/parts/_a_probe_test.go", "package a\n");
    r.write("decks/k/parts/b.probe.ts", "// b\n");
    const g = readPlanChecks(r.root, "decks/k/checks.json", GO);
    const t = readPlanChecks(r.root, "decks/k/checks.json");
    const t2 = readPlanChecks(r.root, "decks/k/checks.json", TYPESCRIPT);
    expect(g.ok && g.texts.probes).toStrictEqual({ a: "package a\n" });
    expect(t.ok && t.texts.probes).toStrictEqual({ b: "// b\n" });
    expect(t2).toStrictEqual(t);
  } finally {
    r.rm();
  }
});

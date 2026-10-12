// P35b probe for plan-command by docs/TASK_P35b_probes.md §2.1 (the harness) and §2.2 (src/cli/planCommand.ts) —
// issue #45: plan --write-probes writes the missing probe skeletons and no deck. New Plan Command examples 24-25.
// Unchanged row: go-mini's own old-form checks cut as before (green on the stub, the current file).
import { test, expect } from "vitest";
import { planCommand } from "../../src/cli/planCommand.js";
import { fixture, tmpRoot } from "../../tests/helpers.js";
import type { TmpRoot } from "../../tests/helpers.js";
import type { Card } from "../../src/cards/types.js";
import type { PlanArgs } from "../../src/cli/types.js";

const MINI = [
  "contour.yaml",
  "morph-map.json",
  "go.mod",
  "internal/testhelp/testhelp.go",
  "decks/m1/parts/_percent-of_probe_test.go",
  "decks/m1/parts/_format-share_probe_test.go",
];
const CV = "decks/m1/parts/_clamp-value_probe_test.go";
const root = (checks: string): TmpRoot => {
  const r = tmpRoot();
  for (const f of MINI) r.write(f, fixture("go-mini/" + f));
  r.write("decks/tools/guard.mjs", "// guard\n");
  r.write("decks/tools/firstdiff.mjs", "// firstdiff\n");
  r.write("decks/m1/checks.json", fixture(checks));
  return r;
};
const args = (out: string | null, writeProbes: boolean): PlanArgs =>
  ({
    name: "plan", root: ".", pretty: false, spec: "contour.yaml", components: ["calc", "report"], map: "morph-map.json",
    judge: true, checks: "decks/m1/checks.json", out, ...(writeProbes ? { writeProbes: true } : {}),
  }) as PlanArgs;
const doc = (probes: string[]) => ({ spec: "contour.yaml", components: ["calc", "report"], probes });

test("Plan Command example 24: the skeleton is written, cut with, never overwritten", () => {
  const r = root("cli/goMini.cut.checks.json");
  try {
    const first = planCommand(r.root, args(null, true));
    expect(first).toStrictEqual({ code: 0, document: doc([CV]) });
    expect(r.read(CV)).toBe(fixture("criterion/skeleton2.probe.go.txt"));
    expect(r.read("decks/m1/parts/_percent-of_probe_test.go")).toBe(fixture("go-mini/decks/m1/parts/_percent-of_probe_test.go"));
    expect(r.read("decks/m1/parts/_format-share_probe_test.go")).toBe(fixture("go-mini/decks/m1/parts/_format-share_probe_test.go"));
    expect(r.exists("decks/m1/deck.json")).toBe(false);

    expect(planCommand(r.root, args("decks/m1/deck.json", false)).code).toBe(0);
    const cards = JSON.parse(r.read("decks/m1/deck.json")) as Card[];
    expect(cards.find((c) => c.customId === "clamp-value")?.acceptance ?? "").toContain("TestProbeClampValueExample4");

    expect(planCommand(r.root, args(null, true))).toStrictEqual({ code: 0, document: doc([]) });
    expect(r.read(CV)).toBe(fixture("criterion/skeleton2.probe.go.txt"));
  } finally {
    r.rm();
  }
});

test("Plan Command example 25: a Default Checks error writes nothing", () => {
  const r = root("cli/goMini.nope.checks.json");
  try {
    expect(planCommand(r.root, args(null, true))).toStrictEqual({
      code: 2,
      document: { error: { code: 2, kind: "DeckError", message: "checks defaults not built (1 error):\nchecks override 'nope' is not a card of the cut" } },
    });
    expect(r.exists(CV)).toBe(false);
  } finally {
    r.rm();
  }
});

test("Plan Command example 25: the old form writes the skeleton too", () => {
  const r = root("go-mini/decks/m1/checks.json");
  try {
    expect(planCommand(r.root, args(null, true))).toStrictEqual({ code: 0, document: doc([CV]) });
    expect(r.read(CV)).toBe(fixture("criterion/skeleton2.probe.go.txt"));
  } finally {
    r.rm();
  }
});

test("Plan Command unchanged: go-mini's own old-form checks cut as before", () => {
  const r = root("go-mini/decks/m1/checks.json");
  try {
    r.write(CV, fixture("go-mini/" + CV));
    expect(planCommand(r.root, args("decks/m1/deck.json", false)).code).toBe(0);
    expect(JSON.parse(r.read("decks/m1/deck.json"))).toStrictEqual(JSON.parse(fixture("cli/goMini.deck.json")));
  } finally {
    r.rm();
  }
});

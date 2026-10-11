// P35a probe for plan-command by docs/TASK_P35a_criterion.md §2.1 (the harness) and §2.2 (src/cli/planCommand.ts) —
// issue #45: the cut form through Default Checks, the probe-name check of both forms, the document's overrides.
// New Plan Command examples 21-23. Unchanged row: go-mini's own old-form checks cut as before (green on the stub).
import { test, expect } from "vitest";
import { planCommand } from "../../src/cli/planCommand.js";
import { fixture, tmpRoot } from "../../tests/helpers.js";
import type { TmpRoot } from "../../tests/helpers.js";
import type { Card } from "../../src/cards/types.js";
import type { PlanArgs, PlanDocument } from "../../src/cli/types.js";

type Doc = PlanDocument & { overrides?: string[]; warnings?: string[] };
const MINI = [
  "contour.yaml",
  "morph-map.json",
  "go.mod",
  "internal/testhelp/testhelp.go",
  "decks/m1/parts/_clamp-value_probe_test.go",
  "decks/m1/parts/_percent-of_probe_test.go",
  "decks/m1/parts/_format-share_probe_test.go",
];
const W = [
  "calc/Clamp Value: step produces 'int' names no Data Object or Event of the record",
  "calc/Percent Of: step produces 'int' names no Data Object or Event of the record",
  "report/Format Share: step produces 'string' names no Data Object or Event of the record",
];
const DR = "decks/m1/parts/_clamp-value_probe_test.go";
const root = (checks: string): TmpRoot => {
  const r = tmpRoot();
  for (const f of MINI) r.write(f, fixture("go-mini/" + f));
  r.write("decks/tools/guard.mjs", "// guard\n");
  r.write("decks/tools/firstdiff.mjs", "// firstdiff\n");
  r.write("decks/m1/checks.json", fixture(checks));
  return r;
};
const args = (out: string, over: Partial<PlanArgs> = {}): PlanArgs => ({
  name: "plan", root: ".", pretty: false, spec: "contour.yaml", components: ["calc", "report"], map: "morph-map.json",
  judge: true, checks: "decks/m1/checks.json", out, ...over,
});
const deckError = (message: string) => ({ error: { code: 2, kind: "DeckError", message } });
const acc = (r: TmpRoot, file: string, id: string): string =>
  (JSON.parse(r.read(file)) as Card[]).find((c) => c.customId === id)?.acceptance ?? "";
const TAG = "MORPH_" + "LITS_EOF"; // the heredoc tag, never written whole in a probe
const L0 = "cat > $P/lits0.json <<'" + TAG + "'\n[]\n" + TAG + "\n";
const L1 = "cat > $P/lits0.json <<'" + TAG + "'\n[\"TestPercentOfExample1\"]\n" + TAG + "\n";

test("Plan Command example 21: the cut form is the old form with the defaults, byte for byte", () => {
  const r = root("cli/goMini.cut.checks.json");
  try {
    const cut = planCommand(r.root, args("decks/m1/deck.json"));
    expect(cut.code).toBe(0);
    expect(Object.keys(cut.document as Doc)).toStrictEqual(["spec", "components", "cards", "generations", "externalDependsOn", "out", "warnings"]);
    expect((cut.document as Doc).warnings).toStrictEqual(W);
    r.write("decks/m1/checks.json", fixture("cli/goMini.defaults.checks.json"));
    const old = planCommand(r.root, args("decks/m1/old.json"));
    expect(old.code).toBe(0);
    expect(r.read("decks/m1/old.json")).toBe(r.read("decks/m1/deck.json"));
    r.write("decks/m1/checks.json", fixture("cli/goMini.override.checks.json"));
    const over = planCommand(r.root, args("decks/m1/over.json"));
    expect(over.code).toBe(0);
    expect(Object.keys(over.document as Doc)).toStrictEqual(["spec", "components", "cards", "generations", "externalDependsOn", "out", "overrides", "warnings"]);
    expect((over.document as Doc).overrides).toStrictEqual(["percent-of-judge: lits from checks.json"]);
    expect(acc(r, "decks/m1/over.json", "percent-of-judge")).toContain(L1);
    expect(acc(r, "decks/m1/deck.json", "percent-of-judge")).toContain(L0);
    for (const id of ["clamp-value", "clamp-value-judge", "percent-of", "format-share", "format-share-judge"]) {
      expect(acc(r, "decks/m1/over.json", id)).toBe(acc(r, "decks/m1/deck.json", id));
    }
  } finally {
    r.rm();
  }
});

test("Plan Command example 22: a drifted probe is exit 2 in both forms; a short one only in the cut form", () => {
  const r = root("cli/goMini.cut.checks.json");
  try {
    r.write(DR, fixture("cli/clampValue.drift.probe.txt"));
    const cut = planCommand(r.root, args("decks/m1/deck.json"));
    expect(cut.code).toBe(2);
    expect(cut.document).toStrictEqual(deckError(
      "probe names differ from the record (2 problems):\n" +
      "card 'clamp-value': probe " + DR + " lacks Clamp Value example 4 (the record gives 4)\n" +
      "card 'clamp-value': probe " + DR + " names Clamp Value example 5, not an example of its Functions (Clamp Value)",
    ));
    expect(r.exists("decks/m1/deck.json")).toBe(false);
    r.write("decks/m1/checks.json", fixture("go-mini/decks/m1/checks.json"));
    const old = planCommand(r.root, args("decks/m1/deck.json"));
    expect(old.code).toBe(2);
    expect(old.document).toStrictEqual(deckError(
      "probe names differ from the record (1 problem):\n" +
      "card 'clamp-value': probe " + DR + " names Clamp Value example 5, which the record does not give",
    ));
    r.write(DR, fixture("cli/clampValue.short.probe.txt"));
    const short = planCommand(r.root, args("decks/m1/short.json"));
    expect(short.code).toBe(0);
    expect(r.exists("decks/m1/short.json")).toBe(true);
    r.write("decks/m1/checks.json", fixture("cli/goMini.cut.checks.json"));
    const shortCut = planCommand(r.root, args("decks/m1/short2.json"));
    expect(shortCut.code).toBe(2);
    expect(shortCut.document).toStrictEqual(deckError(
      "probe names differ from the record (1 problem):\n" +
      "card 'clamp-value': probe " + DR + " lacks Clamp Value example 3, 4 (the record gives 4)",
    ));
  } finally {
    r.rm();
  }
});

test("Plan Command example 23: --only keeps the selected overrides; an unknown id is refused", () => {
  const r = root("cli/goMini.only.checks.json");
  try {
    const only = planCommand(r.root, args("decks/m1/only.json", { only: ["percent-of", "percent-of-judge"] }));
    expect(only.code).toBe(0);
    const deck = JSON.parse(r.read("decks/m1/only.json")) as Card[];
    expect(deck.map((c) => c.customId).slice().sort()).toStrictEqual(["percent-of", "percent-of-judge"]);
    for (const c of deck) expect((c.acceptance ?? "").split("\n")[0]).toBe("# morph: subset transaction");
    expect((only.document as Doc).overrides).toStrictEqual(["percent-of-judge: lits from checks.json"]);
    const before = r.read("decks/m1/only.json");
    r.write("decks/m1/checks.json", fixture("cli/goMini.nope.checks.json"));
    const nope = planCommand(r.root, args("decks/m1/only.json", { only: ["percent-of", "percent-of-judge"] }));
    expect(nope.code).toBe(2);
    expect(nope.document).toStrictEqual(deckError("checks defaults not built (1 error):\nchecks override 'nope' is not a card of the cut"));
    expect(r.read("decks/m1/only.json")).toBe(before);
  } finally {
    r.rm();
  }
});

test("Plan Command unchanged: go-mini's own old-form checks cut as before", () => {
  const r = root("go-mini/decks/m1/checks.json");
  try {
    const res = planCommand(r.root, args("decks/m1/deck.json"));
    expect(res.code).toBe(0);
    expect(JSON.parse(r.read("decks/m1/deck.json"))).toStrictEqual(JSON.parse(fixture("cli/goMini.deck.json")));
  } finally {
    r.rm();
  }
});

// P19b probe for plan-command by docs/TASK_P19b_deps.md §2.2 (src/cli/planCommand.ts) — `morph plan --checks` passes
// Plan Spec's uses and whether vendor/modules.txt is a regular file under root to Build Acceptances (issue #10). Record
// Plan Command examples 10, 11, then rows. The roots are tmp roots, removed in finally.
import { test, expect } from "vitest";
import { planCommand } from "../../src/cli/planCommand.js";
import { codeAcceptance } from "../../src/builder/compose.js";
import { GO_ENV, goCodeAcceptance } from "../../src/builder/goAcceptance.js";
import { DEFAULT_FROZEN } from "../../src/builder/readChecks.js";
import { GO, TYPESCRIPT } from "../../src/language/profiles.js";
import type { CardContext } from "../../src/builder/types.js";
import type { Card } from "../../src/cards/types.js";
import type { CommandResult, PlanArgs, PlanDocument } from "../../src/cli/types.js";
import { fixture, tmpRoot } from "../../tests/helpers.js";
import type { TmpRoot } from "../../tests/helpers.js";

const MODULES = "# github.com/google/go-cmp v0.7.0\n## explicit; go 1.11\ngithub.com/google/go-cmp/cmp\n";
function depsRoot(): TmpRoot {
  const r = tmpRoot();
  r.write("contour.yaml", fixture("planner/deps.yaml"));
  r.write("morph-map.json", fixture("planner/deps.map.json"));
  r.write("docs/deps/yaml.md", "# yaml\n");
  r.write("decks/tools/guard.mjs", "// guard\n");
  r.write("decks/tools/firstdiff.mjs", "// firstdiff\n");
  r.write("decks/d1/checks.json", JSON.stringify({ phase: "d1", cards: [{ id: "read-config", smoke: 3 }, { id: "pad-left", smoke: 2 }] }));
  r.write("decks/d1/parts/read-config.probe.ts", "// probe\n");
  r.write("decks/d1/parts/pad-left.probe.ts", "// probe\n");
  r.write("docs/deps/go-cmp.md", "# go-cmp\n");
  r.write("decks/d2/checks.json", JSON.stringify({ phase: "d2", cards: [{ id: "diff-values", smoke: 4 }] }));
  r.write("decks/d2/parts/_diff-values_probe_test.go", "package diff\n");
  return r;
}
const args = (over: Partial<PlanArgs>): PlanArgs => ({ name: "plan", root: ".", pretty: false, spec: "contour.yaml", map: "morph-map.json",
  components: ["conf", "plain"], judge: false, out: "decks/d1/deck.json", checks: "decks/d1/checks.json", ...over });
const cardsOf = (res: CommandResult): Card[] => {
  expect([res.code, res.code === 0 ? "" : JSON.stringify(res.document)]).toStrictEqual([0, ""]);
  return (res.document as PlanDocument).cards;
};
const accOf = (cards: Card[], id: string): string | null => cards.find((c) => c.customId === id)?.acceptance ?? null;
const RC = ["src/conf/readConfig.ts", "tests/conf/readConfig.test.ts"];
const PL = ["src/plain/padLeft.ts", "tests/plain/padLeft.test.ts"];
const tsCtx = (over: Partial<CardContext>): CardContext => ({ id: "read-config", phase: "d1", targets: RC,
  siblings: PL, frozen: DEFAULT_FROZEN, fullExclude: [], ownGit: false, profile: TYPESCRIPT,
  guard: "// guard\n", firstdiff: "// firstdiff\n", ...over });

test("Plan Command example 10: a typescript card's guard line names its Component's dependencies in record order", () => {
  const r = depsRoot();
  try {
    const cards = cardsOf(planCommand(r.root, args({})));
    expect(cards.map((c) => [c.customId, c.targets])).toStrictEqual([["pad-left", PL], ["read-config", RC], ["check-config", ["src/conf/checkConfig.ts", "tests/conf/checkConfig.test.ts"]]]);
    expect(accOf(cards, "read-config")).toBe(codeAcceptance(tsCtx({ allowed: ["yaml", "zod"] }), "// probe\n", 3, null));
    expect(accOf(cards, "read-config")?.includes("node $P/guard.mjs src src/conf/readConfig.ts 'yaml,zod'; node $P/guard.mjs tests tests/conf/readConfig.test.ts 1 3\n")).toBe(true);
    expect(accOf(cards, "pad-left")).toBe(codeAcceptance(tsCtx({ id: "pad-left", targets: PL, siblings: RC }), "// probe\n", 2, null));
    expect(accOf(cards, "pad-left")?.includes("node $P/guard.mjs src src/plain/padLeft.ts; node")).toBe(true);
    r.write("vendor/modules.txt", "# github.com/google/go-cmp v0.7.0\n");
    cardsOf(planCommand(r.root, args({ out: "decks/d1/deck2.json" })));
    expect(r.read("decks/d1/deck2.json")).toBe(r.read("decks/d1/deck.json"));
  } finally {
    r.rm();
  }
});

test("Plan Command example 11: a go card, -mod=vendor exactly when vendor/modules.txt is a file", () => {
  const r = depsRoot();
  try {
    const goArgs = args({ components: ["diff"], checks: "decks/d2/checks.json", out: "decks/d2/deck.json" });
    const first = cardsOf(planCommand(r.root, goArgs));
    const DV = ["diff/diff_values.go", "diff/diff_values_test.go"];
    expect(first.map((c) => [c.customId, c.targets])).toStrictEqual([["diff-values", DV]]);
    const ctx: CardContext = { id: "diff-values", phase: "d2", targets: DV, siblings: [], frozen: DEFAULT_FROZEN,
      fullExclude: [], ownGit: false, profile: GO, guard: "// guard\n", firstdiff: "// firstdiff\n", allowed: ["github.com/google/go-cmp"], vendor: false };
    const a1 = accOf(first, "diff-values") ?? "";
    expect(a1).toBe(goCodeAcceptance(ctx, "package diff\n", 4, null));
    expect([a1.includes(GO_ENV), a1.includes("node $P/guard.mjs src diff/diff_values.go 'github.com/google/go-cmp'; node $P/guard.mjs tests diff/diff_values_test.go 1 4\n")])
      .toStrictEqual([true, true]);
    r.write("vendor/modules.txt", MODULES);
    const second = cardsOf(planCommand(r.root, { ...goArgs, out: "decks/d2/deck2.json" }));
    const a2 = accOf(second, "diff-values") ?? "";
    expect([a1.split("export GOFLAGS=-mod=mod ").length - 1, a2]).toStrictEqual([1, a1.replace("export GOFLAGS=-mod=mod ", "export GOFLAGS=-mod=vendor ")]);
    expect(second.map((c) => ({ ...c, acceptance: null }))).toStrictEqual(first.map((c) => ({ ...c, acceptance: null })));
  } finally {
    r.rm();
  }
});

test("row: a directory named vendor/modules.txt is not a vendored tree; the other card of a using Component; no checks no change", () => {
  const r = depsRoot();
  try {
    r.write("vendor/modules.txt/x", "");
    const goArgs = args({ components: ["diff"], checks: "decks/d2/checks.json", out: "decks/d2/deck.json" });
    expect(accOf(cardsOf(planCommand(r.root, goArgs)), "diff-values")?.includes(GO_ENV)).toBe(true);
    r.write("decks/d1/checks.json", JSON.stringify({ phase: "d1", cards: [{ id: "check-config", smoke: 5 }] }));
    r.write("decks/d1/parts/check-config.probe.ts", "// probe\n");
    const cc = accOf(cardsOf(planCommand(r.root, args({ components: ["conf"] }))), "check-config");
    expect(cc).toBe(codeAcceptance(tsCtx({ id: "check-config", targets: ["src/conf/checkConfig.ts", "tests/conf/checkConfig.test.ts"], siblings: [],
      allowed: ["yaml", "zod"] }), "// probe\n", 5, null));
    const bare = cardsOf(planCommand(r.root, { ...args({ components: ["conf"], out: null }), checks: undefined }));
    expect(bare.every((c) => !(c.acceptance ?? "").includes("guard.mjs"))).toBe(true);
  } finally {
    r.rm();
  }
});

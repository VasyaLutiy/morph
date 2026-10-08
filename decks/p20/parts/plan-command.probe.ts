// P20 probe for plan-command by docs/TASK_P20_rerun.md §2.2 (src/cli/planCommand.ts) — `morph plan --only` cuts the
// subset and builds its acceptances over the subset alone (issue #11). Record Plan Command examples 12, 13, then rows.
// The roots are tmp roots, removed in finally.
import { test, expect } from "vitest";
import { planCommand } from "../../src/cli/planCommand.js";
import { codeAcceptance } from "../../src/builder/compose.js";
import { DEFAULT_FROZEN } from "../../src/builder/readChecks.js";
import { TYPESCRIPT } from "../../src/language/profiles.js";
import type { Card } from "../../src/cards/types.js";
import type { CommandResult, PlanArgs, PlanDocument } from "../../src/cli/types.js";
import { fixture, tmpRoot } from "../../tests/helpers.js";
import type { TmpRoot } from "../../tests/helpers.js";

const MINI = ["contour.yaml", "morph-map.json", "go.mod", "internal/testhelp/testhelp.go", "decks/m1/checks.json",
  "decks/m1/parts/_clamp-value_probe_test.go", "decks/m1/parts/_percent-of_probe_test.go", "decks/m1/parts/_format-share_probe_test.go"];
function miniRoot(map: string | null): TmpRoot {
  const r = tmpRoot();
  for (const f of MINI) r.write(f, fixture("go-mini/" + f));
  if (map !== null) r.write("morph-map.json", fixture(map));
  r.write("decks/tools/guard.mjs", "// guard\n");
  r.write("decks/tools/firstdiff.mjs", "// firstdiff\n");
  return r;
}
const args = (over: Partial<PlanArgs>): PlanArgs => ({ name: "plan", root: ".", pretty: false, spec: "contour.yaml", map: "morph-map.json",
  components: ["calc", "report"], judge: true, out: "decks/m1/deck.json", checks: "decks/m1/checks.json", ...over });
const docOf = (res: CommandResult): PlanDocument => {
  expect([res.code, res.code === 0 ? "" : JSON.stringify(res.document)]).toStrictEqual([0, ""]);
  return res.document as PlanDocument;
};
const byId = (cards: Card[], id: string): Card | undefined => cards.find((c) => c.customId === id);
const SAME = '{"Replace":{"calc/clamp_value.go":""}}';

test("Plan Command example 12: --only keeps an accepted sibling's file out of the overlay (MorphStudio 201843)", () => {
  const r = miniRoot("cli/goMini.sameGen.map.json");
  try {
    const full = docOf(planCommand(r.root, args({})));
    expect(full.generations).toStrictEqual([["clamp-value", "percent-of"], ["clamp-value-judge", "format-share", "percent-of-judge"], ["format-share-judge"]]);
    const fullCard = byId(full.cards, "percent-of");
    const fullAcc = fullCard?.acceptance ?? "";
    expect(fullAcc.split(SAME).length - 1).toBe(1);
    const only = docOf(planCommand(r.root, args({ only: ["percent-of"], out: "decks/m1/only.json" })));
    expect([only.generations, only.externalDependsOn, only.cards.length]).toStrictEqual([[["percent-of"]], {}, 1]);
    expect(only.cards[0].acceptance).toBe(fullAcc.replace(SAME, '{"Replace":{}}'));
    expect({ ...only.cards[0], acceptance: null }).toStrictEqual({ ...fullCard, acceptance: null });
    expect(r.read("decks/m1/only.json")).toBe(JSON.stringify(only.cards, null, 2) + "\n");
  } finally {
    r.rm();
  }
});

test("Plan Command example 13: two kept siblings still hide each other; unknown ids; no checks", () => {
  const r = miniRoot(null);
  try {
    const two = docOf(planCommand(r.root, args({ only: ["percent-of-judge", "format-share"], out: "decks/m1/two.json" })));
    expect([two.generations, two.externalDependsOn]).toStrictEqual([[["format-share", "percent-of-judge"]], { "format-share": ["percent-of"], "percent-of-judge": ["percent-of"] }]);
    const deck = JSON.parse(fixture("cli/goMini.deck.json")) as Card[];
    expect(two.cards).toStrictEqual([byId(deck, "format-share"), byId(deck, "percent-of-judge")]);
    const bad = planCommand(r.root, args({ only: ["nope", "percent-of", "x.2"], out: "decks/m1/bad.json" }));
    expect(bad).toStrictEqual({ code: 2, document: { error: { code: 2, kind: "DeckError", message: "--only names cards the plan does not have: nope, x.2" } } });
    expect(r.exists("decks/m1/bad.json")).toBe(false);
    const bare = docOf(planCommand(r.root, { ...args({ only: ["clamp-value"], out: null }), checks: undefined }));
    const plain = docOf(planCommand(r.root, { ...args({ out: null }), checks: undefined }));
    expect([bare.cards, bare.generations]).toStrictEqual([[byId(plain.cards, "clamp-value")], [["clamp-value"]]]);
  } finally {
    r.rm();
  }
});

test("row: a typescript subset drops the other card from the per-card tsconfig; the go-mini deck without --only unchanged; a map acceptance kept in the subset", () => {
  const r = tmpRoot();
  try {
    r.write("contour.yaml", fixture("planner/deps.yaml"));
    r.write("morph-map.json", fixture("planner/deps.map.json"));
    r.write("docs/deps/yaml.md", "# yaml\n");
    r.write("decks/tools/guard.mjs", "// guard\n");
    r.write("decks/tools/firstdiff.mjs", "// firstdiff\n");
    r.write("decks/d1/checks.json", JSON.stringify({ phase: "d1", cards: [{ id: "read-config", smoke: 3 }, { id: "pad-left", smoke: 2 }] }));
    r.write("decks/d1/parts/read-config.probe.ts", "// probe\n");
    r.write("decks/d1/parts/pad-left.probe.ts", "// probe\n");
    const d = docOf(planCommand(r.root, { name: "plan", root: ".", pretty: false, spec: "contour.yaml", map: "morph-map.json",
      components: ["conf", "plain"], judge: false, out: null, checks: "decks/d1/checks.json", only: ["read-config"] }));
    expect(d.cards.map((c) => c.customId)).toStrictEqual(["read-config"]);
    expect(d.cards[0].acceptance).toBe(codeAcceptance({ id: "read-config", phase: "d1", targets: ["src/conf/readConfig.ts", "tests/conf/readConfig.test.ts"],
      siblings: [], frozen: DEFAULT_FROZEN, fullExclude: [], ownGit: false, profile: TYPESCRIPT, guard: "// guard\n", firstdiff: "// firstdiff\n",
      allowed: ["yaml", "zod"] }, "// probe\n", 3, null));
  } finally {
    r.rm();
  }
  const m = miniRoot(null);
  try {
    docOf(planCommand(m.root, args({})));
    expect(m.read("decks/m1/deck.json")).toBe(fixture("cli/goMini.deck.json"));
    const map = JSON.parse(fixture("go-mini/morph-map.json")) as { cards: Record<string, Record<string, unknown>> };
    map.cards["format-share"].acceptance = "echo map-acc";
    m.write("morph-map.json", JSON.stringify(map));
    const sub = docOf(planCommand(m.root, args({ only: ["percent-of-judge", "format-share"], out: null })));
    expect(sub.cards.map((c) => [c.customId, c.acceptance === "echo map-acc"])).toStrictEqual([["format-share", true], ["percent-of-judge", false]]);
  } finally {
    m.rm();
  }
});

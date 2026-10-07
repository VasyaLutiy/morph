import fs from "node:fs";
import path from "node:path";
import { fileURLToPath } from "node:url";
import { test, expect } from "vitest";
import { planCommand } from "../../src/cli/planCommand.js";
import { codeAcceptance, judgeAcceptance } from "../../src/builder/compose.js";
import { DEFAULT_FROZEN } from "../../src/builder/readChecks.js";
import { TYPESCRIPT } from "../../src/language/profiles.js";
import { loadDeck } from "../../src/cards/model.js";
import type { CardContext } from "../../src/builder/types.js";
import type { PlanArgs, PlanDocument } from "../../src/cli/types.js";
import type { Plan } from "../../src/planner/types.js";
import { fixture, fixtureJson, tmpRoot } from "../helpers.js";
import type { TmpRoot } from "../helpers.js";

const REPO = fileURLToPath(new URL("../..", import.meta.url));
function l1Root(): TmpRoot {
  const r = tmpRoot();
  r.write("ledger.yaml", fixture("planner/ledger.yaml"));
  r.write("ledger.map.json", fixture("planner/ledger.map.json"));
  r.write("tests/helpers.ts", "export {};\n");
  r.write("decks/tools/guard.mjs", "// guard\n");
  r.write("decks/tools/firstdiff.mjs", "// firstdiff\n");
  r.write("decks/l1/checks.json", fixture("cli/l1.checks.json"));
  r.write("decks/l1/parts/parse.probe.ts", "// probe\n");
  r.write("decks/l1/parts/ledger-types.probe.ts", "// probe\n");
  return r;
}
const args = (over: Partial<PlanArgs>): PlanArgs => ({ name: "plan", root: ".", pretty: false, spec: "ledger.yaml",
  components: ["ledger", "store"], map: "ledger.map.json", judge: true, out: "decks/p.json", checks: "decks/l1/checks.json", ...over });
const ctx = (over: Partial<CardContext>): CardContext => ({
  id: "parse", phase: "l1", targets: ["src/ledger/parse.ts"], siblings: ["src/ledger/types.ts"], frozen: DEFAULT_FROZEN,
  fullExclude: [], ownGit: false, profile: TYPESCRIPT, guard: "// guard\n", firstdiff: "// firstdiff\n", ...over,
});
const JUDGE_FILE = { file: "tests/ledger/parse.examples.test.ts", min: 1, max: 9, lits: [], drop: [], new: false };

test("Plan Command example 6: checks build the acceptances, the map override wins", () => {
  const r = l1Root();
  try {
    const result = planCommand(r.root, args({}));
    const plan = fixtureJson("planner/ledger.plan.json") as Plan;
    const cards = plan.cards.map((c) => {
      if (c.customId === "parse") {
        return { ...c, acceptance: codeAcceptance(ctx({}), "// probe\n", null, null) };
      }
      if (c.customId === "parse-judge") {
        return {
          ...c,
          acceptance: judgeAcceptance(ctx({ id: "parse-judge", targets: [JUDGE_FILE.file], siblings: [] }), [JUDGE_FILE]),
        };
      }
      return c;
    });
    expect(result).toStrictEqual({ code: 0, document: { ...plan, cards, out: "decks/p.json" } });
    const ledgerTypes = cards.find((c) => c.customId === "ledger-types");
    if (ledgerTypes === undefined) throw new Error("ledger-types missing from the plan");
    expect(ledgerTypes.acceptance).toBe("exit 0\n");
    expect(r.read("decks/p.json")).toBe(JSON.stringify(cards, null, 2) + "\n");
  } finally {
    r.rm();
  }
});

test("Plan Command example 7: an unknown checks card is a DeckError", () => {
  const r = l1Root();
  try {
    r.write("decks/l2/checks.json", JSON.stringify({ phase: "l2", cards: [{ id: "zz" }] }) + "\n");
    const result = planCommand(r.root, args({ checks: "decks/l2/checks.json", out: "decks/q.json" }));
    expect(result).toStrictEqual({
      code: 2,
      document: {
        error: {
          code: 2,
          kind: "DeckError",
          message: "acceptances not built (1 error):\nchecks card 'zz' is not in the deck",
        },
      },
    });
    expect(r.exists("decks/q.json")).toBe(false);
  } finally {
    r.rm();
  }
});

test("Plan Command example 8: the P10a deck byte for byte on the repository", () => {
  const result = planCommand(REPO, {
    name: "plan",
    root: ".",
    pretty: false,
    spec: "contour.yaml",
    components: ["planner", "cli"],
    map: "tests/fixtures/cli/p10.map.json",
    judge: true,
    out: null,
    checks: "decks/p10/checks.json",
  });
  expect(result.code).toBe(0);
  if (result.code !== 0) throw new Error("unreachable");
  const document = result.document as PlanDocument;
  const oldGuard = fixture("builder/guard.p10.txt").trimEnd();
  const liveGuard = fs.readFileSync(path.join(REPO, "decks/tools/guard.mjs"), "utf8").trimEnd();
  const loaded = loadDeck(fs.readFileSync(path.join(REPO, "decks/p10/v2deck.json"), "utf8"));
  if (!loaded.ok) throw new Error("v2deck.json does not load");
  const byId = new Map(document.cards.map((c) => [c.customId, c]));
  for (const card of loaded.deck.cards) {
    const got = byId.get(card.customId);
    if (got === undefined) throw new Error("card missing from the plan: " + card.customId);
    expect(got.acceptance).toBe((card.acceptance ?? "").split(oldGuard).join(liveGuard));
  }
});

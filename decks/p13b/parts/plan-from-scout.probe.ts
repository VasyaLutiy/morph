// P13b probe for plan-from-scout by docs/TASK_P13b_scout.md §2.2 (Plan From Scout) — `morph plan --from-scout`: a scout
// session (.morph/scout/<id>/scout.json, "latest" = the last id by name holding one) turned into ONE patch card on the
// files its answer names: the targets caged and measured on disk now, missing context files dropped, the instruction the
// question + PATCH_CONTRACT, the acceptance from the language profile, maxTokens from the targets' bytes; the deck file
// written to --out. Record Plan From Scout examples 1-4, then the §2.2 rows. The sessions are tests/fixtures/scout/*.json.
import fs from "node:fs";
import { test, expect } from "vitest";
import { PATCH_CONTRACT, SCOUT_SESSIONS, patchAcceptance, patchCard, planFromScout } from "../../src/scout/planFromScout.js";
import { loadDeck } from "../../src/cards/model.js";
import type { Card } from "../../src/cards/types.js";
import { fixture, tmpRoot } from "../../tests/helpers.js";
import type { TmpRoot } from "../../tests/helpers.js";

const ID = "20261008-225320-74e423b1";
const OLD = "20200101-000000-00000000";
const B = 'import { a } from "./a.js";\nexport const b = a + 1;\n';
const TS = "node_modules/.bin/tsc --noEmit && node_modules/.bin/vitest run --reporter=dot";
const NO_ANSWER = "no answer: the model call failed in round 1: stub has no answer: /tmp/morph-side-l5V4h4/ans/scout.t1.md";

function tree(session: string = fixture("scout/session.json")): TmpRoot {
  const p = tmpRoot("morph-pfs-");
  p.write("README.md", "tiny\n");
  p.write("src/a.ts", "export const a = 1;\n");
  p.write("src/b.ts", B);
  p.write(`.morph/scout/${ID}/scout.json`, session);
  return p;
}
const CARD: Card = {
  customId: "scout-" + ID,
  intent: "patch",
  targets: ["src/b.ts"],
  contextSlice: ["src/a.ts", "README.md"],
  instruction: "Make b twice a.\n\n" + PATCH_CONTRACT,
  acceptance: TS,
  model: null,
  maxTokens: 16000,
  reasoning: null,
  variants: 1,
  dependsOn: [],
};
const err = (code: number, kind: string, message: string) => ({ code, document: { error: { code, kind, message } } });

test("Plan From Scout example 1: the latest session becomes one patch card, written to --out", () => {
  const p = tree();
  try {
    const got = planFromScout(p.root, { fromScout: "latest", out: "decks/s.json" });
    expect(got).toStrictEqual({ code: 0, document: { scoutId: ID, scout: `.morph/scout/${ID}/scout.json`,
      ref: "2e7116d687d05d6d6d18c5dad347cdcf78de3c0b", cards: [CARD], dropped: [], out: "decks/s.json" } });
    const text = p.read("decks/s.json");
    expect(text).toBe(JSON.stringify([CARD], null, 2) + "\n");
    const deck = loadDeck(text);
    expect(deck.ok && deck.deck.cards.length).toBe(1);
  } finally {
    p.rm();
  }
});

test("Plan From Scout example 2: which session — latest by name with a scout.json, a named one, none", () => {
  const p = tree();
  const e = tmpRoot("morph-pfs-");
  try {
    p.write(`.morph/scout/${OLD}/scout.json`, fixture("scout/noAnswer.json"));
    p.write(".morph/scout/20991231-000000-ffffffff/notes.txt", "no session here\n");
    const latest = planFromScout(p.root, { fromScout: "latest", out: null });
    expect([latest.code, (latest.document as { scoutId: string }).scoutId]).toStrictEqual([0, ID]);
    expect(planFromScout(p.root, { fromScout: ID, out: null })).toStrictEqual(latest);
    expect(planFromScout(p.root, { fromScout: OLD, out: null })).toStrictEqual(
      err(2, "RefusalError", `scout session ${OLD} has no answer (no_answer): ${NO_ANSWER}`));
    expect(planFromScout(p.root, { fromScout: "zz", out: null })).toStrictEqual(err(4, "UsageError", "scout session not found: zz"));
    expect(planFromScout(e.root, { fromScout: "latest", out: "d.json" })).toStrictEqual(err(4, "UsageError", "no scout session under .morph/scout"));
    expect([p.exists("decks"), e.exists("d.json")]).toStrictEqual([false, false]);
  } finally {
    p.rm();
    e.rm();
  }
});

test("Plan From Scout example 3: the session's file and its paths checked now — refusals and a dropped context file", () => {
  const doc = JSON.parse(fixture("scout/session.json")) as { schema: number; answer: { targets: string[] } };
  const p = tree(JSON.stringify({ ...doc, schema: 2 }));
  try {
    const at = `.morph/scout/${ID}/scout.json`;
    const run = () => planFromScout(p.root, { fromScout: ID, out: null });
    expect(run()).toStrictEqual(err(2, "DeckError", `${at}: schema 2, expected 1`));
    p.write(at, "{");
    expect(run()).toStrictEqual(err(2, "DeckError", `${at} does not parse`));
    p.write(at, JSON.stringify({ ...doc, answer: { ...doc.answer, targets: ["../x.ts"] } }));
    expect(run()).toStrictEqual(err(2, "RefusalError", "target refused: path leaves the root: ../x.ts"));
    p.write(at, JSON.stringify({ ...doc, answer: { ...doc.answer, targets: ["src"] } }));
    expect(run()).toStrictEqual(err(2, "RefusalError", "target refused: not a file: src"));
    p.write(at, fixture("scout/session.json"));
    fs.rmSync(p.path("README.md"));
    const kept = run();
    expect([kept.code, (kept.document as { dropped: string[] }).dropped]).toStrictEqual([0, ["README.md"]]);
    expect((kept.document as { cards: Card[] }).cards[0].contextSlice).toStrictEqual(["src/a.ts"]);
    fs.rmSync(p.path("src/b.ts"));
    expect(run()).toStrictEqual(err(2, "RefusalError", "target refused: no such file: src/b.ts"));
  } finally {
    p.rm();
  }
});

test("Plan From Scout example 4: the acceptance by profile and maxTokens by the targets' bytes", () => {
  expect(patchAcceptance(["a.py", "b.md", "c.py"])).toBe("python3 -m py_compile a.py c.py && python3 -m pytest -q --tb=short");
  expect(patchAcceptance(["notes.md", "x.ts", "y.py"])).toBe(TS);
  expect(patchAcceptance(["notes.md"])).toBe(null);
  const input = { scoutId: "s1", question: "  Do it.\n\n", targets: ["n.md"], contextSlice: [], targetBytes: 30000 };
  expect(patchCard(input)).toStrictEqual({ customId: "scout-s1", intent: "patch", targets: ["n.md"], contextSlice: [],
    instruction: "Do it.\n\n" + PATCH_CONTRACT, acceptance: null, model: null, maxTokens: 20000, reasoning: null, variants: 1, dependsOn: [] });
  expect([100, 24000, 24001, 24002].map((n) => patchCard({ ...input, targetBytes: n }).maxTokens)).toStrictEqual([16000, 16000, 16002, 16002]);
});

test("§2.2 rows: the constants; a target written as ./src/b.ts is refused; the deck file's parents created", () => {
  expect(SCOUT_SESSIONS).toBe(".morph/scout");
  expect(PATCH_CONTRACT).toBe("Change the target files of this card to do the task above. Return each target file COMPLETE, not a diff. " +
    "Keep the public names the files already declare: other code imports them. Write or change no other file.");
  const doc = JSON.parse(fixture("scout/session.json")) as { answer: { targets: string[] } };
  const p = tree(JSON.stringify({ ...doc, answer: { ...doc.answer, targets: ["./src/b.ts"] } }));
  try {
    expect(planFromScout(p.root, { fromScout: "latest", out: null })).toStrictEqual(
      err(2, "RefusalError", "target refused: not in the tree (missing, ignored or a directory): ./src/b.ts"));
    p.write(`.morph/scout/${ID}/scout.json`, fixture("scout/session.json"));
    p.write("src/b.ts", "x".repeat(30001));
    const got = planFromScout(p.root, { fromScout: "latest", out: "a/b/c.json" });
    expect((got.document as { cards: Card[] }).cards[0].maxTokens).toBe(20002);
    expect(JSON.parse(p.read("a/b/c.json"))).toStrictEqual((got.document as { cards: Card[] }).cards);
    const at = `.morph/scout/${ID}/scout.json`;
    const full = JSON.parse(fixture("scout/session.json")) as Record<string, unknown>;
    p.write(at, JSON.stringify({ ...full, status: "invalid_answer" }));
    expect(planFromScout(p.root, { fromScout: ID, out: null })).toStrictEqual(
      err(2, "RefusalError", `scout session ${ID} has no answer (invalid_answer): the model answered on its own`));
    p.write(at, JSON.stringify({ ...full, answer: null }));
    expect(planFromScout(p.root, { fromScout: ID, out: null })).toStrictEqual(
      err(2, "RefusalError", `scout session ${ID} has no answer (ok): the model answered on its own`));
    p.write(at, JSON.stringify({ ...full, answer: { targets: [], context_slice: [], reasoning: "" } }));
    expect(planFromScout(p.root, { fromScout: ID, out: null })).toStrictEqual(
      err(2, "DeckError", `${at}: the answer has no targets or the session no question`));
    p.write("src/b.ts", B);
    p.write(at, JSON.stringify({ ...full, answer: { targets: ["src/b.ts", "src/a.ts"], context_slice: ["src", "README.md"], reasoning: "" } }));
    const two = planFromScout(p.root, { fromScout: ID, out: null }).document as { cards: Card[]; dropped: string[] };
    expect([two.dropped, two.cards[0].contextSlice, two.cards[0].maxTokens]).toStrictEqual([["src"], ["README.md"], 16000]);
    p.write("src/a.ts", "y".repeat(30000));
    const big = planFromScout(p.root, { fromScout: ID, out: null }).document as { cards: Card[] };
    expect(big.cards[0].maxTokens).toBe(20036);
    p.write(at, JSON.stringify({ ...full, question: " \n" }));
    expect(planFromScout(p.root, { fromScout: ID, out: null })).toStrictEqual(
      err(2, "DeckError", `${at}: the answer has no targets or the session no question`));
  } finally {
    p.rm();
  }
});

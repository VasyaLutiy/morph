// P17 probe for card-brief by docs/TASK_P17_debt.md §2.2 (src/debt/cardBrief.ts) — findCard's three refusals, the
// document's keys and order, readLastRun (descending run names, corrupt reports skipped, the escaped answer pattern) and
// renderBrief byte for byte. Record Card Brief examples 1-3, then two rows.
import { test, expect } from "vitest";
import { cardBrief, findCard, readLastRun, renderBrief, RUNS_DIR } from "../../src/debt/cardBrief.js";
import type { BriefDocument } from "../../src/debt/cardBrief.js";
import { fixture, fixtureJson, tmpRoot } from "../../tests/helpers.js";
import type { TmpRoot } from "../../tests/helpers.js";

const A = fixtureJson("debt/archive.json") as { reports: Record<string, unknown>; answers: Record<string, string[]> };

function tree(withArchive: boolean): TmpRoot {
  const t = tmpRoot();
  t.write("d.json", fixture("debt/deck.json"));
  t.write("src/x.ts", "export const x = 1;\n");
  t.write("docs/a.md", "# A\n");
  t.write("docs/b.md", "B");
  if (withArchive) {
    for (const [id, r] of Object.entries(A.reports))
      t.write(".morph/runs/" + id + "/report.json", typeof r === "string" ? r : JSON.stringify(r, null, 2) + "\n");
    for (const [id, names] of Object.entries(A.answers)) for (const n of names) t.write(".morph/runs/" + id + "/answers/" + n, "A\n");
  }
  return t;
}

const FMT_RUN = {
  runId: "20261102-100000", processor: "glm53", status: "failed", reason: "acceptance failed", attempts: 2, earlierFailures: 1,
  acceptanceLog: "== probe\nAssertionError: expected 2 to be 1\n",
  answers: [".morph/runs/20261102-100000/answers/fmt.x.r1.v1.answer.txt", ".morph/runs/20261102-100000/answers/fmt.x.v1.answer.txt"],
};

test("Card Brief example 1: the card as its executor saw it, the newest run that holds it", () => {
  const t = tree(true);
  try {
    expect(cardBrief(t.root, { deck: "d.json", id: "fmt.x", md: false })).toStrictEqual({
      code: 0,
      document: {
        deck: "d.json", card: "fmt.x", intent: "patch",
        targets: [{ path: "src/x.ts", text: "export const x = 1;\n" }, { path: "src/y.ts", text: null }],
        slice: [{ path: "docs/a.md", text: "# A\n" }, { path: "docs/b.md", text: "B" }, { path: "docs/gone.md", text: null }],
        instruction: "Fix x and write y.\n", acceptance: "grep -q fixed src/x.ts", maxTokens: 9000, model: null,
        dependsOn: ["base"], lastRun: FMT_RUN,
      },
    });
  } finally {
    t.rm();
  }
});

test("Card Brief example 2: the markdown byte for byte; base's run is the newest", () => {
  const t = tree(true);
  try {
    const fmt = cardBrief(t.root, { deck: "d.json", id: "fmt.x", md: true }).document as BriefDocument;
    expect(fmt.markdown).toBe(fixture("debt/brief.fmt.x.md"));
    expect(Object.keys(fmt)).toStrictEqual(["deck", "card", "intent", "targets", "slice", "instruction", "acceptance",
      "maxTokens", "model", "dependsOn", "lastRun", "markdown"]);
    const solo = cardBrief(t.root, { deck: "d.json", id: "solo", md: true }).document as BriefDocument;
    expect(solo.lastRun).toBe(null);
    expect(solo.markdown).toBe(fixture("debt/brief.solo.md"));
    const base = cardBrief(t.root, { deck: "d.json", id: "base", md: false }).document as BriefDocument;
    expect([base.lastRun, base.targets, base.slice]).toStrictEqual([
      { runId: "20261103-110000", processor: "ds", status: "written", reason: null, attempts: 1, earlierFailures: 0,
        acceptanceLog: "== tsc\n== probe\n", answers: [] },
      [{ path: "src/base.ts", text: null }], [],
    ]);
  } finally {
    t.rm();
  }
});

test("Card Brief example 3: the refusals; no archive gives lastRun null", () => {
  const t = tree(true);
  const bare = tree(false);
  try {
    t.write("c.json", fixture("decks/cycle.json"));
    expect([
      cardBrief(t.root, { deck: "nope.json", id: "fmt.x", md: false }),
      cardBrief(t.root, { deck: "c.json", id: "a", md: false }),
      cardBrief(t.root, { deck: "d.json", id: "zz", md: true }),
    ]).toStrictEqual([
      { code: 4, document: { error: { code: 4, kind: "UsageError", message: "deck file not found: nope.json" } } },
      { code: 2, document: { error: { code: 2, kind: "DeckError", message: "invalid deck: dependsOn: dependsOn cycle a -> b -> a" } } },
      { code: 4, document: { error: { code: 4, kind: "UsageError", message: "no card 'zz' in d.json (have: base, fmt.x, solo)" } } },
    ]);
    expect((cardBrief(bare.root, { deck: "d.json", id: "fmt.x", md: false }).document as BriefDocument).lastRun).toBe(null);
  } finally {
    t.rm();
    bare.rm();
  }
});

test("rows: readLastRun's order and skips, findCard, RUNS_DIR", () => {
  const t = tmpRoot();
  try {
    expect(RUNS_DIR).toBe(".morph/runs");
    expect(readLastRun(t.root, "q")).toBe(null);
    t.write(".morph/runs/a1/report.json", JSON.stringify({ outcomes: [{ customId: "q", status: "failed" }] }));
    t.write(".morph/runs/b2/report.json", JSON.stringify({ processor: 7, outcomes: [{ customId: "q", status: "written",
      reason: "r", attempts: 4, acceptanceLog: "L", earlierFailures: ["x", "y", "z"] }] }));
    t.write(".morph/runs/c3/report.json", JSON.stringify({ outcomes: { q: 1 } }));
    t.write(".morph/runs/d4/report.json", "[]");
    t.write(".morph/runs/e5/notes.txt", "x");
    t.write(".morph/runs/b2/answers/q.v10.answer.txt", "A");
    t.write(".morph/runs/b2/answers/q.r12.v1.answer.txt", "A");
    t.write(".morph/runs/b2/answers/q.v1.answer.txt.bak", "A");
    t.write(".morph/runs/b2/answers/xq.v1.answer.txt", "A");
    t.write(".morph/runs/b2/answers/q.vx.answer.txt", "A");
    expect(readLastRun(t.root, "q")).toStrictEqual({ runId: "b2", processor: null, status: "written", reason: "r", attempts: 4,
      earlierFailures: 3, acceptanceLog: "L", answers: [".morph/runs/b2/answers/q.r12.v1.answer.txt", ".morph/runs/b2/answers/q.v10.answer.txt"] });
    t.write(".morph/runs/a0/report.json", JSON.stringify({ processor: "p", outcomes: [{ customId: "q2" }] }));
    expect(readLastRun(t.root, "q2")).toStrictEqual({ runId: "a0", processor: "p", status: "", reason: null, attempts: 0,
      earlierFailures: 0, acceptanceLog: "", answers: [] });
    t.write("d.json", JSON.stringify([{ customId: "k", intent: "generate", targets: ["k.ts"], instruction: "k" }]));
    const found = findCard(t.root, "d.json", "k");
    expect(found.ok && found.card.contextSlice).toStrictEqual([]);
    t.write("bad.json", "{");
    const bad = findCard(t.root, "bad.json", "k");
    expect(!bad.ok && bad.result.code).toBe(2);
  } finally {
    t.rm();
  }
});

test("rows: renderBrief on its edges (the newline rule, none, trimmed instruction)", () => {
  const doc: BriefDocument = {
    deck: "decks/p9/deck.json", card: "w", intent: "generate", targets: [{ path: "a/w.ts", text: "" }, { path: "a/v.ts", text: "v" }],
    slice: [], instruction: "Do w.  \n\n", acceptance: "true\n", maxTokens: 1, model: null, dependsOn: ["p", "q"],
    lastRun: { runId: "r9", processor: null, status: "failed", reason: null, attempts: 3, earlierFailures: 2, acceptanceLog: "", answers: [] },
  };
  expect(renderBrief(doc)).toBe(
    "# Debt brief: w\n\nWrite only: `a/w.ts`, `a/v.ts`. Change no other file.\nThen: `morph accept --deck decks/p9/deck.json --id w " +
    "--model <your model> --commit`.\n\n- deck: decks/p9/deck.json\n- intent: generate\n- maxTokens: 1\n- model: none\n" +
    "- dependsOn: p, q\n- last run: r9, processor none, failed, attempts 3, reason none\n\n## Instruction\n\nDo w.\n\n" +
    "## Acceptance\n\n<acceptance>\ntrue\n</acceptance>\n\n## Last run\n\n<acceptance_log>\n</acceptance_log>\n\nAnswers: none\n\n" +
    "## Targets now\n\n<file path=\"a/w.ts\">\n</file>\n\n<file path=\"a/v.ts\">\nv\n</file>\n\n## Context slice\n\nnone\n");
});

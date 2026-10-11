// P25 probe for scout-command by docs/TASK_P25_config.md §2.2 (src/scout/scoutCommand.ts) — issue #18 items 1, 4:
// the settings give the session's budgets, caps and seed; a given --deadline beats them. Record Scout Command example 6;
// the no-settings record (example 1's budgets and caps) green on main by design.
import fs from "node:fs";
import { test, expect } from "vitest";
import { tmpRepo, tmpRoot } from "../../tests/helpers.js";
import { PROTOCOL } from "../../src/scout/runScout.js";
import { DEFAULT_TOOL_CAPS } from "../../src/scout/runTool.js";
import { DEFAULT_BUDGETS } from "../../src/scout/spendBudget.js";
import { budgetSentence } from "../../src/scout/sessionText.js";
import * as sc from "../../src/scout/scoutCommand.js";

const S = {
  grepSkip: [".morph/", "decks/", "docs/TASK_"],
  budgets: { calls: 5, reads: 4, chars: 9000, rounds: 6, deadlineSeconds: 900 },
  caps: { readLines: 1, readChars: 12000, grepHits: 200, grepLineChars: 300, listEntries: 300 },
  seed: { files: 6, chars: 8000 },
};
type Rec = { budgets: unknown; caps: unknown; spent: unknown };
type Call = (root: string, args: { processor: string; issue: string; seedFile: string | null; deadlineSeconds: number | null },
  deps: { env: Record<string, string>; now: () => number; cwd: string; transport: null }, settings?: typeof S) => Promise<{ code: number; document: unknown }>;
const scout = sc.scoutCommand as unknown as Call;

async function once(deadlineSeconds: number | null, settings: typeof S | undefined): Promise<{ rec: Rec; transcript: string[] }> {
  const t = tmpRepo();
  const s = tmpRoot();
  try {
    t.write("README.md", "tiny\n");
    t.write("src/a.ts", "export const a = 1;\n");
    t.git(["add", "."]);
    t.git(["commit", "-q", "-m", "files"]);
    t.write("src/b.ts", "import { a } from \"./a.js\";\nexport const b = a + 1;\n");
    t.git(["add", "."]);
    t.git(["commit", "-q", "-m", "morph b: src/b.ts\n\nMorph-Card: b\nMorph-Model: m/b"]);
    s.write("task.txt", "Make b twice a.\n");
    fs.mkdirSync(s.path("ans"), { recursive: true });
    s.write("ans/scout.t1.md", "READ src/b.ts");
    s.write("ans/scout.t2.md", "ANSWER {\"targets\": [\"src/b.ts\"], \"context_slice\": [\"src/a.ts\"], \"reasoning\": \"b reads a\"}");
    const env = { PATH: process.env["PATH"] ?? "", MORPH_PROCESSOR_s_TYPE: "stub", MORPH_PROCESSOR_s_ANSWERS_DIR: s.path("ans") };
    const result = await scout(t.root, { processor: "s", issue: "task.txt", seedFile: null, deadlineSeconds },
      { env, now: () => 1791500000000, cwd: s.root, transport: null }, settings);
    expect(result.code).toBe(0);
    const dir = ".morph/scout/20261008-225320-74e423b1/";
    const transcript = (JSON.parse(t.read(dir + "transcript.json")) as { content: string }[]).map((m) => m.content);
    return { rec: JSON.parse(t.read(dir + "scout.json")) as Rec, transcript };
  } finally {
    s.rm();
    t.rm();
  }
}

test("Scout Command example 1: no settings and a deadline keep the record's budgets and caps (green on main)", async () => {
  const { rec } = await once(60, undefined);
  expect(rec.budgets).toStrictEqual({ ...DEFAULT_BUDGETS, deadlineMs: 60000 });
  expect(rec.caps).toStrictEqual(DEFAULT_TOOL_CAPS);
});

test("Scout Command example 6: settings give the budgets, caps and seed; the flag beats the settings' deadline", async () => {
  expect((sc as Record<string, unknown>)["DEFAULT_SCOUT_SETTINGS"]).toStrictEqual({
    grepSkip: [".morph", "decks"],
    budgets: { calls: 30, reads: 12, chars: 120000, rounds: 40, deadlineSeconds: 1800 },
    caps: { readLines: 400, readChars: 12000, grepHits: 200, grepLineChars: 300, listEntries: 300 },
    seed: { files: 6, chars: 8000 },
  });
  const a = await once(null, S);
  const B = { calls: 5, reads: 4, chars: 9000, rounds: 6, deadlineMs: 900000 };
  expect(a.rec.budgets).toStrictEqual(B);
  expect(a.rec.caps).toStrictEqual({ readLines: 1, readChars: 12000, grepHits: 200, grepLineChars: 300, listEntries: 300,
    grepSkip: [".morph/", "decks/", "docs/TASK_"] });
  expect(a.rec.spent).toStrictEqual({ calls: 1, reads: 1, chars: 106, rounds: 2 });
  expect(a.transcript[0]).toBe(PROTOCOL + "\n" + budgetSentence(B));
  expect(a.transcript[3]).toBe("READ src/b.ts lines 1-1 of 2\n1: import { a } from \"./a.js\";\n… 1 more lines; READ src/b.ts 2-2 for the next\n\nBudget left: 4 calls, 3 file reads, 8894 chars, 5 rounds.");
  const b = await once(60, S);
  expect(b.rec.budgets).toStrictEqual({ ...B, deadlineMs: 60000 });
  const c = await once(null, undefined);
  expect(c.rec.budgets).toStrictEqual(DEFAULT_BUDGETS);
  expect(c.rec.caps).toStrictEqual(DEFAULT_TOOL_CAPS);
});

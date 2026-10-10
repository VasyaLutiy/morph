// P27 probe for scout-command by docs/TASK_P27_scout.md §2.2 (src/scout/scoutCommand.ts) — issue #21 item 11:
// the recent commits in round 0 (with the P27 texts of run-scout and run-tool around them). Record Scout Command example 1.
import fs from "node:fs";
import { test, expect } from "vitest";
import { tmpRepo, tmpRoot } from "../../tests/helpers.js";
import { PROTOCOL } from "../../src/scout/runScout.js";
import { scoutCommand } from "../../src/scout/scoutCommand.js";
import { SEED_HEADER } from "../../src/scout/seedFromOwnership.js";

const SENTENCE = "Your budget: 30 tool calls, 12 files read, 120000 characters of tool replies, 40 rounds. When the calls, reads or characters run out you get one last turn: send ANSWER in it; an answer refused there gets one correction.";
const READ_B = "READ src/b.ts lines 1-2 of 2\n1: import { a } from \"./a.js\";\n2: export const b = a + 1;";

test("Scout Command example 1: the transcript carries the budget, the line counts and the recent commits", async () => {
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
    const result = await scoutCommand(t.root, { processor: "s", issue: "task.txt", seedFile: null, deadlineSeconds: 60 },
      { env, now: () => 1791500000000, cwd: s.root, transport: null });
    expect(result.code).toBe(0);
    const log = t.git(["log", "-n", "10", "--format=%h %s"]).trim();
    expect(log.split("\n").map((l) => l.replace(/^\S+ /, ""))).toStrictEqual(["morph b: src/b.ts", "files"]);
    const transcript = JSON.parse(t.read(".morph/scout/20261008-225320-74e423b1/transcript.json")) as { role: string; content: string }[];
    expect(transcript.map((m) => m.content)).toStrictEqual([
      PROTOCOL + "\n" + SENTENCE,
      SEED_HEADER + "\n- src/b.ts: written by b (m/b, run —)\n\nLIST .: 2 entries\nREADME.md (1 line)\nsrc/ (2 files)\n\nRecent commits (newest first):\n" + log + "\n\nTask:\nMake b twice a.\n",
      "READ src/b.ts",
      READ_B + "\n\nBudget left: 29 calls, 11 file reads, 119914 chars, 39 rounds.",
      "ANSWER {\"targets\": [\"src/b.ts\"], \"context_slice\": [\"src/a.ts\"], \"reasoning\": \"b reads a\"}",
    ]);
  } finally {
    s.rm();
    t.rm();
  }
});

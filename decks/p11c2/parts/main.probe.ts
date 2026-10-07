// P11c2 probe for main (the entry src/cli.ts) by docs/TASK_P11c2_runner.md §2.2 (issue #5 finding 6) — the entry keeps
// the first SIGINT/SIGTERM its listeners catch and hands `interrupted: () => that name` to main; a signal during a run
// kills the acceptance group, stops the run as the fault "interrupted by <SIG>", archives it, exit 3. The test process
// is never signalled: the entry runs under tsx in a child and its own acceptance signals it ($PPID).
// Record Main example 6, then the §2.2 rows.
import { test, expect } from "vitest";
import { spawnSync } from "node:child_process";
import fs from "node:fs";
import path from "node:path";
import { fileURLToPath } from "node:url";
import type { RunDocument } from "../../src/cli/types.js";
import { tmpRepo, tmpRoot } from "../../tests/helpers.js";

const REPO = path.resolve(path.dirname(fileURLToPath(import.meta.url)), "../..");
const gitEnv = (home: string): Record<string, string> => ({ PATH: process.env.PATH ?? "", HOME: home, GIT_CONFIG_NOSYSTEM: "1",
  GIT_AUTHOR_NAME: "Ada", GIT_AUTHOR_EMAIL: "ada@example.invalid", GIT_COMMITTER_NAME: "Ada", GIT_COMMITTER_EMAIL: "ada@example.invalid" });
const gone = (pid: number): boolean => {
  try {
    return fs.readFileSync("/proc/" + pid + "/stat", "utf8").split(" ")[2] === "Z";
  } catch {
    return true;
  }
};

function signalled(sig: "INT" | "TERM", runId: string): void {
  const r = tmpRepo();
  const side = tmpRoot("morph-p11c2-side-");
  let pid = 0;
  try {
    side.write("answers/a.md", "```ts\nexport const a = 1;\n```\n");
    side.write("deck.json", JSON.stringify([
      { customId: "a", intent: "generate", targets: ["out/a.ts"], instruction: "x",
        acceptance: "sleep 30 & echo $! > " + side.path("sleep.pid") + "; kill -" + sig + " $PPID; wait" },
      { customId: "b", intent: "generate", targets: ["out/b.ts"], instruction: "x", acceptance: "true", dependsOn: ["a"] }]));
    const res = spawnSync(process.execPath, ["--import", "tsx", "src/cli.ts", "run", "--root", r.root, "--deck", side.path("deck.json"),
      "--processor", "s", "--run-id", runId], { cwd: REPO, encoding: "utf8", timeout: 30000,
      env: { ...gitEnv(r.root), MORPH_PROCESSOR_s_TYPE: "stub", MORPH_PROCESSOR_s_ANSWERS_DIR: side.path("answers") } });
    pid = side.exists("sleep.pid") ? Number(side.read("sleep.pid").trim()) : 0;
    expect(`${res.status} ${res.signal}`, "exit: " + res.stderr.slice(-400)).toBe("3 null");
    const doc = JSON.parse(res.stdout) as RunDocument;
    expect(doc.report.fault, "fault").toBe("interrupted by SIG" + sig);
    expect(doc.report.outcomes.map((o) => `${o.customId} ${o.status} ${o.reason}`).join("; "), "outcomes")
      .toBe("a failed acceptance failed; b skipped fault");
    expect(doc.report.outcomes[0]?.acceptanceLog.endsWith("acceptance interrupted by SIG" + sig + "\n"), "a's log").toBe(true);
    expect(`${doc.archive.ok} ${doc.archive.dir}`, "archive").toBe("true .morph/runs/" + runId);
    expect(res.stderr.endsWith("morph run: exit 3\n"), "stderr's last line").toBe(true);
    expect(pid > 0 && gone(pid), "the sleep " + pid + " is gone").toBe(true);
    expect(`${r.git(["symbolic-ref", "--short", "HEAD"])}|${r.git(["log", "-1", "--format=%s"])}|${r.git(["status", "--porcelain"])}`, "git")
      .toBe("morph/" + runId + "|morph run " + runId + ": deck and report|");
  } finally {
    try {
      if (pid > 0) process.kill(pid, "SIGKILL");
    } catch {
      // already gone
    }
    r.rm();
    side.rm();
  }
}

test("Main example 6: SIGINT during a run stops it with its archive, exit 3, no orphan", () => {
  signalled("INT", "sig");
});

test("§2.2 rows: SIGTERM the same way, its own name in the fault", () => {
  signalled("TERM", "p6t");
});

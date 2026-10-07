// P11c2 probe for run-acceptance by docs/TASK_P11c2_runner.md §2.2 (issue #5 finding 6) — while the child lives, a SIGINT
// or SIGTERM of this process kills the acceptance group (SIGKILL, like the timeout); the result is exit null, timedOut
// false, the output so far + "acceptance interrupted by <signal>\n"; both listeners are gone after the call. The test
// process is never signalled: a child node (tsx) runs runAcceptance and its acceptance signals that child ($PPID).
// Record Run Acceptance example 6, then the §2.2 rows.
import { test, expect } from "vitest";
import { spawnSync } from "node:child_process";
import fs from "node:fs";
import path from "node:path";
import { fileURLToPath } from "node:url";
import { runAcceptance } from "../../src/acceptance/run.js";
import { tmpRoot } from "../../tests/helpers.js";
import type { TmpRoot } from "../../tests/helpers.js";

const REPO = path.resolve(path.dirname(fileURLToPath(import.meta.url)), "../..");
const SCRIPT = 'import { runAcceptance } from ' + JSON.stringify(path.join(REPO, "src/acceptance/run.ts")) + ';\n' +
  'const result = await runAcceptance(process.argv[2], process.argv[3], { env: { PATH: "/usr/bin:/bin" } });\n' +
  'process.stdout.write(JSON.stringify({ result, listeners: process.listenerCount("SIGINT") + process.listenerCount("SIGTERM") }) + "\\n");\n';
const gone = (pid: number): boolean => {
  try {
    return fs.readFileSync("/proc/" + pid + "/stat", "utf8").split(" ")[2] === "Z";
  } catch {
    return true;
  }
};
function child(s: TmpRoot, root: TmpRoot, command: string): { status: number | null; signal: string | null; stdout: string; err: string; pid: number } {
  s.write("child.mts", SCRIPT);
  const res = spawnSync(process.execPath, ["--import", "tsx", s.path("child.mts"), command, root.root],
    { cwd: REPO, encoding: "utf8", timeout: 20000 });
  const pid = root.exists("sleep.pid") ? Number(root.read("sleep.pid").trim()) : 0;
  return { status: res.status, signal: res.signal, stdout: res.stdout, err: res.stderr.slice(0, 400), pid };
}
const kill = (pid: number): void => {
  try {
    if (pid > 0) process.kill(pid, "SIGKILL");
  } catch {
    // already gone
  }
};

test("Run Acceptance example 6: SIGTERM while the child lives kills the group; no listener outlives the call", () => {
  const s = tmpRoot("morph-p11c2-s-");
  const root = tmpRoot("morph-p11c2-r-");
  let pid = 0;
  try {
    const got = child(s, root, "echo started; sleep 30 & echo $! > sleep.pid; kill -TERM $PPID; wait");
    pid = got.pid;
    expect(`${got.status} ${got.signal}`, "the child ran to its end: " + got.stdout + got.err).toBe("0 null");
    expect(got.stdout, "the result").toBe('{"result":{"exit":null,"log":"started\\nacceptance interrupted by SIGTERM\\n","timedOut":false},"listeners":0}\n');
    expect(pid > 0 && gone(pid), "the sleep " + pid + " is gone").toBe(true);
  } finally {
    kill(pid);
    s.rm();
    root.rm();
  }
});

test("§2.2 rows: SIGINT, output without a final newline", () => {
  const s = tmpRoot("morph-p11c2-s-");
  const root = tmpRoot("morph-p11c2-r-");
  let pid = 0;
  try {
    const got = child(s, root, "printf begun; sleep 30 & echo $! > sleep.pid; kill -INT $PPID; wait");
    pid = got.pid;
    expect(`${got.status} ${got.signal}`, "the child ran to its end: " + got.stdout + got.err).toBe("0 null");
    expect(got.stdout, "the result").toBe('{"result":{"exit":null,"log":"begun\\nacceptance interrupted by SIGINT\\n","timedOut":false},"listeners":0}\n');
    expect(pid > 0 && gone(pid), "the sleep " + pid + " is gone").toBe(true);
  } finally {
    kill(pid);
    s.rm();
    root.rm();
  }
});

test("§2.2 rows: in process, a normal run and a failed start leave the listener counts as they were", async () => {
  const root = tmpRoot("morph-p11c2-");
  try {
    const count = (): number => process.listenerCount("SIGINT") + process.listenerCount("SIGTERM");
    const before = count();
    const ok = await runAcceptance("echo ok; exit 4", root.root, { env: { PATH: "/usr/bin:/bin" } });
    expect(`${ok.exit} ${ok.timedOut} ${JSON.stringify(ok.log)} ${count() - before}`, "normal run").toBe('4 false "ok\\n" 0');
    const bad = await runAcceptance("true", root.path("missing-dir"), { env: { PATH: "/usr/bin:/bin" } });
    expect(`${bad.exit} ${bad.log.startsWith("acceptance could not start: ")} ${count() - before}`, "spawn error").toBe("null true 0");
  } finally {
    root.rm();
  }
});

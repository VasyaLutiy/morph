// P3 probe for run-acceptance: runAcceptance and clipLog by docs/TASK_P3_acceptance.md §2.2,
// one test per record example, values and types. Runs from probe/run-acceptance/ under
// vitest; every example spawns a real /bin/sh in its own tmpRoot() with env
// {PATH: "/usr/bin:/bin"}. No timer here: the only timer is the product's own.
import { test, expect } from "vitest";
import fs from "node:fs";
import { DEFAULT_TIMEOUT_MS, LOG_CAP, clipLog, runAcceptance } from "../../src/acceptance/run.js";
import type { AcceptanceResult, RunOptions } from "../../src/acceptance/types.js";
import { fixture, fixturePath, tmpRoot } from "../../tests/helpers.js";

const ENV: Record<string, string> = { PATH: "/usr/bin:/bin" };
const show = (r: AcceptanceResult): string => JSON.stringify(r);

function gone(pid: number): boolean {
  const stat = `/proc/${pid}/stat`;
  if (!fs.existsSync(stat)) return true;
  try {
    return (fs.readFileSync(stat, "utf8").split(") ")[1] ?? "").startsWith("Z");
  } catch {
    return true;
  }
}

test("Run Acceptance example 1: stdout and stderr merged, the exit code kept", async () => {
  const r = tmpRoot();
  try {
    const opts: RunOptions = { env: ENV };
    const got: AcceptanceResult = await runAcceptance("echo out; echo err >&2; exit 3", r.root, opts);
    expect(show(got), "the whole result").toBe('{"exit":3,"log":"out\\nerr\\n","timedOut":false}');
    expect(`${DEFAULT_TIMEOUT_MS} ${LOG_CAP}`, "the constants").toBe("300000 4000");
  } finally {
    r.rm();
  }
});

test("Run Acceptance example 2: NO_COLOR and CI forced, only the given env, cwd is root", async () => {
  const r = tmpRoot();
  try {
    r.write("marker.txt", "here\n");
    const got = await runAcceptance('echo "$NO_COLOR $CI $FOO ${HOME-unset}"; cat marker.txt', r.root,
      { env: { PATH: "/usr/bin:/bin", FOO: "bar", NO_COLOR: "0" } });
    expect(got.log, "NO_COLOR CI FOO HOME, then marker.txt from root").toBe("1 1 bar unset\nhere\n");
    expect(`${got.exit} ${got.timedOut}`, "exit 0, no timeout").toBe("0 false");
  } finally {
    r.rm();
  }
});

test("Run Acceptance example 3: a timeout kills the process group, no orphan survives", async () => {
  const r = tmpRoot();
  try {
    const t0 = Date.now();
    const got = await runAcceptance("echo started; sleep 30 & echo $! > sleep.pid; wait", r.root,
      { env: ENV, timeoutMs: 200 });
    const ms = Date.now() - t0;
    expect(`${got.exit} ${got.timedOut}`, "a kill is exit null, timedOut true").toBe("null true");
    expect(got.log, "the log kept, the timeout line appended").toBe("started\nacceptance timed out after 200 ms\n");
    expect(ms < 2000, `returned in under 2000 ms (took ${ms} ms)`).toBe(true);
    const pid = Number(r.read("sleep.pid").trim());
    expect(pid > 0, "sleep.pid holds the pid of the backgrounded sleep").toBe(true);
    expect(gone(pid), `the sleep (pid ${pid}) is gone: the process group was killed`).toBe(true);
  } finally {
    r.rm();
  }
});

test("Run Acceptance example 4: a long log is clipped head + diagnosis lines + tail", async () => {
  const r = tmpRoot();
  try {
    const src = fixturePath("acceptance/longLog.txt");
    const want = fixture("acceptance/longLogClipped.txt");
    const got = await runAcceptance(`cat '${src}'`, r.root, { env: ENV });
    expect(`${got.exit} ${got.timedOut}`, "exit 0, no timeout").toBe("0 false");
    expect(got.log.length, "3154 chars").toBe(3154);
    expect(got.log, "exactly longLogClipped.txt").toBe(want);
    const text = fixture("acceptance/longLog.txt");
    expect(clipLog(text) === want, "clipLog(longLog.txt) is longLogClipped.txt").toBe(true);
    expect(clipLog("short\n"), "4000 chars or fewer: unchanged").toBe("short\n");
    const four = "x".repeat(4000);
    expect(clipLog(four) === four, "exactly 4000 chars: unchanged").toBe(true);
  } finally {
    r.rm();
  }
});

import { expect, test } from "vitest";
import fs from "node:fs";
import type { AcceptanceResult } from "../../src/acceptance/types.js";
import {
  DEFAULT_TIMEOUT_MS,
  LOG_CAP,
  clipLog,
  runAcceptance,
} from "../../src/acceptance/run.js";
import { fixture, fixturePath, flush, tmpRoot } from "../helpers.js";

const PATH_ENV: Record<string, string> = { PATH: "/usr/bin:/bin" };

/** A pid counts as gone when /proc/<pid>/stat is absent or its state is Z. */
function pidGone(pid: number): boolean {
  const statPath = "/proc/" + pid + "/stat";
  if (!fs.existsSync(statPath)) {
    return true;
  }
  let stat = "";
  try {
    stat = fs.readFileSync(statPath, "utf8");
  } catch {
    return true;
  }
  const cut = stat.lastIndexOf(") ");
  return cut >= 0 && stat.slice(cut + 2, cut + 3) === "Z";
}

/** Gives the kernel a few ticks to finish reaping before the final check. */
async function untilGone(pid: number): Promise<boolean> {
  for (let i = 0; i < 100; i++) {
    if (pidGone(pid)) {
      return true;
    }
    await flush();
  }
  return pidGone(pid);
}

test("Run Acceptance example 1: exit code 3 with stderr merged into stdout", async () => {
  const r = tmpRoot();
  try {
    const res: AcceptanceResult = await runAcceptance(
      "echo out; echo err >&2; exit 3",
      r.root,
      { env: PATH_ENV },
    );
    expect(res.exit).toBe(3);
    expect(res.log).toBe("out\nerr\n");
    expect(res.timedOut).toBe(false);
  } finally {
    r.rm();
  }
});

test("Run Acceptance example 2: env is exactly the given one, cwd is root", async () => {
  const r = tmpRoot();
  try {
    r.write("marker.txt", "here\n");
    const res: AcceptanceResult = await runAcceptance(
      'echo "$NO_COLOR $CI $FOO ${HOME-unset}"; cat marker.txt',
      r.root,
      { env: { PATH: "/usr/bin:/bin", FOO: "bar", NO_COLOR: "0" } },
    );
    expect(res.exit).toBe(0);
    expect(res.log).toBe("1 1 bar unset\nhere\n");
    expect(res.timedOut).toBe(false);
  } finally {
    r.rm();
  }
});

test("Run Acceptance example 3: timeout kills the process group, no orphan", async () => {
  const r = tmpRoot();
  try {
    const before = Date.now();
    const res: AcceptanceResult = await runAcceptance(
      "echo started; sleep 30 & echo $! > sleep.pid; wait",
      r.root,
      { env: PATH_ENV, timeoutMs: 200 },
    );
    const after = Date.now();
    expect(after - before).toBeLessThan(2000);
    expect(res.exit).toBe(null);
    expect(res.timedOut).toBe(true);
    expect(res.log).toBe("started\nacceptance timed out after 200 ms\n");
    const pid = Number(r.read("sleep.pid").trim());
    expect(pid).toBeGreaterThan(1);
    expect(await untilGone(pid)).toBe(true);
  } finally {
    r.rm();
  }
});

test("Run Acceptance example 4: a 6403-char log is clipped to the 3154 chars of the fixture", async () => {
  const r = tmpRoot();
  try {
    const res: AcceptanceResult = await runAcceptance(
      "cat '" + fixturePath("acceptance/longLog.txt") + "'",
      r.root,
      { env: PATH_ENV },
    );
    expect(res.exit).toBe(0);
    expect(res.timedOut).toBe(false);
    expect(res.log).toBe(fixture("acceptance/longLogClipped.txt"));
  } finally {
    r.rm();
  }
});

test("constants: DEFAULT_TIMEOUT_MS and LOG_CAP", () => {
  expect(DEFAULT_TIMEOUT_MS).toBe(300000);
  expect(LOG_CAP).toBe(4000);
});

test("run: a green command exits 0", async () => {
  const r = tmpRoot();
  try {
    const res: AcceptanceResult = await runAcceptance("echo hi", r.root, {
      env: PATH_ENV,
    });
    expect(res.exit).toBe(0);
    expect(res.log).toBe("hi\n");
    expect(res.timedOut).toBe(false);
  } finally {
    r.rm();
  }
});

test("clipLog: a text within LOG_CAP is returned unchanged", () => {
  const text = "out\nerr\n";
  expect(clipLog(text)).toBe(text);
});

test("clipLog: a text of exactly 4000 chars is returned unchanged", () => {
  const text = "a".repeat(4000);
  expect(clipLog(text)).toBe(text);
});

test("clipLog: 4001 chars with no diagnosis line give just the markers", () => {
  const text = "a".repeat(1500) + "b" + "c".repeat(2500);
  const expected =
    "a".repeat(1500) +
    "\n[... 1001 chars clipped; diagnosis lines kept:]\n" +
    "[...]\n" +
    "c".repeat(1500);
  expect(clipLog(text)).toBe(expected);
});

test("clipLog: a kept diagnosis line is cut to its first 200 chars", () => {
  const line = "Error" + "e".repeat(250);
  const text = "x".repeat(1500) + line + "\n" + "y".repeat(1500) + "z".repeat(1000);
  const expected =
    "x".repeat(1500) +
    "\n[... 1256 chars clipped; diagnosis lines kept:]\n" +
    line.slice(0, 200) + "\n" +
    "[...]\n" +
    "y".repeat(500) + "z".repeat(1000);
  expect(clipLog(text)).toBe(expected);
});

test("clipLog: the diagnosis budget stops the walk at 800 chars", () => {
  const line = "Error" + ".".repeat(194);
  const text =
    "x".repeat(1500) +
    (line + "\n").repeat(5) +
    "y".repeat(1500) +
    "z".repeat(1000);
  const expected =
    "x".repeat(1500) +
    "\n[... 2000 chars clipped; diagnosis lines kept:]\n" +
    (line + "\n").repeat(4) +
    "[...]\n" +
    "y".repeat(500) + "z".repeat(1000);
  expect(clipLog(text)).toBe(expected);
});

test("run: a timeout over an empty log appends only the timeout line", async () => {
  const r = tmpRoot();
  try {
    const res = await runAcceptance("sleep 5", r.root, {
      env: PATH_ENV,
      timeoutMs: 200,
    });
    expect(res.exit).toBe(null);
    expect(res.timedOut).toBe(true);
    expect(res.log).toBe("acceptance timed out after 200 ms\n");
  } finally {
    r.rm();
  }
});

test("run: a timeout over a log not ending in a newline gets one first", async () => {
  const r = tmpRoot();
  try {
    const res = await runAcceptance("printf started; sleep 5", r.root, {
      env: PATH_ENV,
      timeoutMs: 200,
    });
    expect(res.exit).toBe(null);
    expect(res.timedOut).toBe(true);
    expect(res.log).toBe("started\nacceptance timed out after 200 ms\n");
  } finally {
    r.rm();
  }
});

test("run: a root that cannot be spawn into resolves, never rejects", async () => {
  const r = tmpRoot();
  try {
    r.rm();
    const res = await runAcceptance("echo hi", r.root, { env: PATH_ENV });
    expect(res.exit).toBe(null);
    expect(res.timedOut).toBe(false);
    expect(res.log.startsWith("acceptance could not start: ")).toBe(true);
    expect(res.log.endsWith("\n")).toBe(true);
  } finally {
    r.rm();
  }
});

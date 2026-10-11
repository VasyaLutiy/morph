import { spawnSync } from "node:child_process";
import fs from "node:fs";
import path from "node:path";
import { fileURLToPath } from "node:url";
import { expect, test } from "vitest";
import { tmpRoot } from "../helpers.js";

const REPO = path.resolve(path.dirname(fileURLToPath(import.meta.url)), "../..");

/** A pid is gone when /proc holds no entry for it or its state is Z. */
function isGone(pid: number): boolean {
  let stat: string;
  try {
    stat = fs.readFileSync("/proc/" + pid + "/stat", "utf8");
  } catch {
    return true;
  }
  return stat.split(" ")[2] === "Z";
}

test("Run Acceptance example 6: a SIGTERM to the caller kills the group and is logged", () => {
  const root = tmpRoot();
  let sleepPid: number | null = null;
  try {
    root.write(
      "child.mts",
      "import { runAcceptance } from " +
        JSON.stringify(path.join(REPO, "src/acceptance/run.ts")) +
        ";\n" +
        'const result = await runAcceptance(process.argv[2], process.argv[3], { env: { PATH: "/usr/bin:/bin" } });\n' +
        'process.stdout.write(JSON.stringify({ result, listeners: process.listenerCount("SIGINT") + process.listenerCount("SIGTERM") }) + "\\n");\n',
    );
    const command = "echo started; sleep 30 & echo $! > sleep.pid; kill -TERM $PPID; wait";
    const res = spawnSync(
      process.execPath,
      ["--import", "tsx", root.path("child.mts"), command, root.root],
      { cwd: REPO, encoding: "utf8", timeout: 20000 },
    );
    sleepPid = Number(root.read("sleep.pid").trim());

    expect(res.status).toBe(0);
    expect(res.stdout.endsWith("\n")).toBe(true);
    expect(JSON.parse(res.stdout)).toStrictEqual({
      result: {
        exit: null,
        log: "started\nacceptance interrupted by SIGTERM\n",
        timedOut: false,
      },
      listeners: 0,
    });
    expect(isGone(sleepPid)).toBe(true);
  } finally {
    if (sleepPid !== null && sleepPid > 0) {
      try {
        process.kill(sleepPid, "SIGKILL");
      } catch {
        // already gone
      }
    }
    root.rm();
  }
});

import { spawnSync } from "node:child_process";
import fs from "node:fs";
import path from "node:path";
import { fileURLToPath } from "node:url";
import { expect, test } from "vitest";
import { tmpRepo, tmpRoot } from "../helpers.js";

const REPO = path.resolve(path.dirname(fileURLToPath(import.meta.url)), "../..");

interface MainOutcome {
  customId: string;
  status: string;
  reason: string | null;
  acceptanceLog: string | null;
}

interface MainDoc {
  runId: string;
  branch: string;
  report: { fault: string | null; outcomes: MainOutcome[] };
  archive: { ok: boolean; dir: string };
}

function pidGone(pid: number): boolean {
  try {
    const stat = fs.readFileSync("/proc/" + pid + "/stat", "utf8");
    return stat.split(" ")[2] === "Z";
  } catch {
    return true;
  }
}

function gitEnv(home: string): Record<string, string> {
  return {
    PATH: process.env.PATH ?? "",
    HOME: home,
    GIT_CONFIG_NOSYSTEM: "1",
    GIT_AUTHOR_NAME: "Ada",
    GIT_AUTHOR_EMAIL: "ada@example.invalid",
    GIT_COMMITTER_NAME: "Ada",
    GIT_COMMITTER_EMAIL: "ada@example.invalid",
  };
}

test("Main example 6: a SIGINT inside the acceptance stops the run with its archive", () => {
  const r = tmpRepo();
  const side = tmpRoot("morph-side-");
  try {
    const fence = "\u0060\u0060\u0060";
    side.write("answers/a.md", fence + "ts\nexport const a = 1\n" + fence + "\n");
    const pidPath = side.path("sleep.pid");
    side.write(
      "deck.json",
      JSON.stringify(
        [
          {
            customId: "a",
            intent: "generate",
            targets: ["out/a.ts"],
            instruction: "make a",
            acceptance: "sleep 30 & echo $! > " + pidPath + "; kill -INT $PPID; wait",
          },
          {
            customId: "b",
            intent: "generate",
            targets: ["out/b.ts"],
            instruction: "make b",
            acceptance: "true",
            dependsOn: ["a"],
          },
        ],
        null,
        2,
      ) + "\n",
    );

    const res = spawnSync(
      process.execPath,
      [
        "--import",
        "tsx",
        "src/cli.ts",
        "run",
        "--root",
        r.root,
        "--deck",
        side.path("deck.json"),
        "--processor",
        "s",
        "--run-id",
        "sig",
      ],
      {
        cwd: REPO,
        encoding: "utf8",
        timeout: 30000,
        env: {
          ...gitEnv(r.root),
          MORPH_PROCESSOR_s_TYPE: "stub",
          MORPH_PROCESSOR_s_ANSWERS_DIR: side.path("answers"),
        },
      },
    );

    expect(res.status).toBe(3);
    expect(res.stdout.endsWith("\n")).toBe(true);
    expect(res.stdout.indexOf("\n")).toBe(res.stdout.length - 1);
    const doc = JSON.parse(res.stdout) as MainDoc;
    expect(doc.report.fault).toBe("interrupted by SIGINT");
    const a = doc.report.outcomes.find((o) => o.customId === "a");
    const b = doc.report.outcomes.find((o) => o.customId === "b");
    expect(a?.status).toBe("failed");
    expect(a?.reason).toBe("acceptance failed");
    expect((a?.acceptanceLog ?? "").endsWith("acceptance interrupted by SIGINT\n")).toBe(true);
    expect(b?.status).toBe("skipped");
    expect(b?.reason).toBe("fault");
    expect(doc.archive.ok).toBe(true);
    expect(doc.archive.dir).toBe(".morph/runs/sig");
    expect(res.stderr.endsWith("morph run: exit 3\n")).toBe(true);

    const pid = Number(side.read("sleep.pid").trim());
    expect(pidGone(pid)).toBe(true);

    expect(r.git(["symbolic-ref", "--short", "HEAD"])).toBe("morph/sig");
    expect(r.git(["log", "-1", "--format=%s"])).toBe("morph run sig: deck and report");
    expect(r.git(["status", "--porcelain"])).toBe("");
  } finally {
    if (side.exists("sleep.pid")) {
      try {
        process.kill(Number(side.read("sleep.pid").trim()), "SIGKILL");
      } catch {
        // already gone
      }
    }
    side.rm();
    r.rm();
  }
});

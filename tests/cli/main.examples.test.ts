import { execFileSync, spawnSync } from "node:child_process";
import fs from "node:fs";
import path from "node:path";
import { fileURLToPath } from "node:url";
import { afterAll, beforeAll, expect, test } from "vitest";
import { main } from "../../src/cli/main.js";
import type { CliDeps, CliIo, ExitCode } from "../../src/cli/types.js";
import { fixture, tmpRepo, tmpRoot } from "../helpers.js";
import type { TmpRoot } from "../helpers.js";

const REPO = path.resolve(path.dirname(fileURLToPath(import.meta.url)), "../..");
let bin: TmpRoot | null = null;
let cliJs = "";

beforeAll(() => {
  bin = tmpRoot("morph-bin-");
  execFileSync(
    process.execPath,
    [
      path.join(REPO, "node_modules/typescript/bin/tsc"),
      "-p",
      path.join(REPO, "tsconfig.build.json"),
      "--outDir",
      bin.root,
    ],
    { cwd: REPO, stdio: "pipe" },
  );
  bin.write("package.json", '{"type":"module"}\n');
  fs.symlinkSync(path.join(REPO, "node_modules"), path.join(bin.root, "node_modules"), "dir");
  cliJs = path.join(bin.root, "cli.js");
}, 120000);

afterAll(() => {
  bin?.rm();
  bin = null;
});

function recordIo(): { io: CliIo; out: string[]; err: string[] } {
  const out: string[] = [];
  const err: string[] = [];
  return {
    out,
    err,
    io: {
      stdout: (t: string) => {
        out.push(t);
      },
      stderr: (t: string) => {
        err.push(t);
      },
    },
  };
}

function stubEnv(home: string, answersDir: string): Record<string, string> {
  return {
    PATH: process.env.PATH ?? "",
    HOME: home,
    GIT_CONFIG_NOSYSTEM: "1",
    GIT_AUTHOR_NAME: "Ada",
    GIT_AUTHOR_EMAIL: "ada@example.invalid",
    GIT_COMMITTER_NAME: "Ada",
    GIT_COMMITTER_EMAIL: "ada@example.invalid",
    MORPH_PROCESSOR_s_TYPE: "stub",
    MORPH_PROCESSOR_s_ANSWERS_DIR: answersDir,
  };
}

test("Main example 1: unknown command answers exit 4 with one usage document", async () => {
  const r = tmpRoot();
  const { io, out, err } = recordIo();
  const deps: CliDeps = { env: {}, now: () => 1791310149000, cwd: r.root, transport: null };
  try {
    const code: ExitCode = await main(["frobnicate"], deps, io);
    expect(code).toBe(4);
    expect(out).toStrictEqual([
      '{"error":{"code":4,"kind":"UsageError","message":"unknown command: frobnicate"}}\n',
    ]);
    expect(err).toStrictEqual(["morph: unknown command: frobnicate\n"]);
  } finally {
    r.rm();
  }
});

test("Main example 2: deck check on the write-write fixture exits 2 with a pretty document", async () => {
  const r = tmpRoot();
  r.write("d.json", fixture("decks/hazardsWriteWrite.json"));
  const { io, out, err } = recordIo();
  const deps: CliDeps = { env: {}, now: () => 1791310149000, cwd: r.root, transport: null };
  try {
    const code: ExitCode = await main(
      ["deck", "check", "--deck", "d.json", "--root", r.root, "--pretty"],
      deps,
      io,
    );
    expect(code).toBe(2);
    expect(out.length).toBe(1);
    expect(out[0].startsWith('{\n  "deck": "d.json",\n  "cards": 2,')).toBe(true);
    expect(err).toStrictEqual(["morph deck check: exit 2\n"]);
  } finally {
    r.rm();
  }
});

test("Main example 3: a run in a directory that is not a git repository exits 3", async () => {
  const r = tmpRoot();
  const side = tmpRoot();
  side.write(
    "deck.json",
    JSON.stringify([
      { customId: "a", intent: "generate", targets: ["out/a.ts"], instruction: "x", acceptance: "test -f out/a.ts" },
    ]),
  );
  const { io, out, err } = recordIo();
  const deps: CliDeps = {
    env: stubEnv(r.root, side.path("answers")),
    now: () => 1791310149000,
    cwd: r.root,
    transport: null,
  };
  try {
    const code: ExitCode = await main(
      ["run", "--root", r.root, "--deck", side.path("deck.json"), "--processor", "s", "--run-id", "r1"],
      deps,
      io,
    );
    expect(code).toBe(3);
    expect(out.length).toBe(1);
    const doc = JSON.parse(out[0]) as { error: { code: number; kind: string; message: string } };
    expect(doc.error.code).toBe(3);
    expect(doc.error.kind).toBe("RuntimeError");
    expect(doc.error.message.startsWith("git status failed (exit 128): ")).toBe(true);
    expect(err).toStrictEqual(["morph run: exit 3\n"]);
  } finally {
    r.rm();
    side.rm();
  }
});

test("Main example 4: the built binary runs a stub deck end to end and exits 0", () => {
  const r = tmpRepo();
  const side = tmpRoot();
  side.write("answers/a.md", "```ts\nexport const a = 1;\n```\n");
  side.write("answers/b.md", "```ts\nexport const b = 1;\n```\n");
  side.write(
    "deck.json",
    JSON.stringify([
      { customId: "a", intent: "generate", targets: ["out/a.ts"], instruction: "x", acceptance: "test -f out/a.ts" },
      {
        customId: "b",
        intent: "generate",
        targets: ["out/b.ts"],
        instruction: "x",
        acceptance: "test -f out/b.ts",
        dependsOn: ["a"],
      },
    ]),
  );
  const env = stubEnv(r.root, side.path("answers"));
  try {
    const res = spawnSync(
      process.execPath,
      [
        cliJs,
        "run",
        "--root",
        r.root,
        "--deck",
        side.path("deck.json"),
        "--processor",
        "s",
        "--run-id",
        "e2e",
      ],
      { cwd: r.root, env, encoding: "utf8" },
    );
    expect(res.status).toBe(0);
    const lines = res.stdout.split("\n");
    expect(lines.length).toBe(2);
    expect(lines[1]).toBe("");
    const doc = JSON.parse(lines[0]) as {
      runId: string;
      branch: string;
      report: { outcomes: { status: string }[] };
      archive: { ok: boolean };
    };
    expect(doc.runId).toBe("e2e");
    expect(doc.branch).toBe("morph/e2e");
    expect(doc.report.outcomes.map((o) => o.status)).toStrictEqual(["written", "written"]);
    expect(doc.archive.ok).toBe(true);
    const subjects = r.git(["log", "--format=%s"]).split("\n");
    expect(subjects.slice(0, 3)).toStrictEqual([
      "morph run e2e: deck and report",
      "morph b: out/b.ts",
      "morph a: out/a.ts",
    ]);
    expect(res.stderr).toBe("morph run: exit 0\n");
  } finally {
    r.rm();
    side.rm();
  }
}, 60000);

test("Main example 5: the built binary answers an unknown command with exit 4", () => {
  const r = tmpRoot();
  try {
    const res = spawnSync(process.execPath, [cliJs, "frobnicate"], {
      cwd: r.root,
      env: { PATH: process.env.PATH ?? "" },
      encoding: "utf8",
    });
    expect(res.status).toBe(4);
    expect(res.stdout).toBe(
      '{"error":{"code":4,"kind":"UsageError","message":"unknown command: frobnicate"}}\n',
    );
    expect(res.stderr).toBe("morph: unknown command: frobnicate\n");
  } finally {
    r.rm();
  }
});

// P7 probe for main: main() by docs/TASK_P7_cli.md §2.2, one test per record example (Component cli,
// Function Main 1-5) — in-process with recorded io, and the BUILT binary: tsc -p tsconfig.build.json into
// a tmpRoot (plus {"type":"module"}), then `node <out>/cli.js` in a tmpRepo on the stub processor —
// then the §2.2 rows and the types.
import { test, expect, expectTypeOf, beforeAll, afterAll } from "vitest";
import { execFileSync, spawnSync } from "node:child_process";
import path from "node:path";
import { fileURLToPath } from "node:url";
import { main } from "../../src/cli/main.js";
import type { CliDeps, CliIo, ExitCode } from "../../src/cli/types.js";
import { fixture, tmpRepo, tmpRoot } from "../../tests/helpers.js";
import type { TmpRoot } from "../../tests/helpers.js";

const REPO = path.resolve(path.dirname(fileURLToPath(import.meta.url)), "../..");
let out: TmpRoot;
beforeAll(() => {
  out = tmpRoot("morph-bin-");
  execFileSync(process.execPath, [path.join(REPO, "node_modules/typescript/bin/tsc"), "-p",
    path.join(REPO, "tsconfig.build.json"), "--outDir", out.root], { cwd: REPO, stdio: "pipe" });
  out.write("package.json", '{"type":"module"}\n');
}, 120000);
afterAll(() => out.rm());

function env(home: string, answers: string): Record<string, string> {
  return {
    PATH: process.env.PATH ?? "", HOME: home, GIT_CONFIG_NOSYSTEM: "1",
    GIT_AUTHOR_NAME: "Ada", GIT_AUTHOR_EMAIL: "ada@example.invalid",
    GIT_COMMITTER_NAME: "Ada", GIT_COMMITTER_EMAIL: "ada@example.invalid",
    MORPH_PROCESSOR_s_TYPE: "stub", MORPH_PROCESSOR_s_ANSWERS_DIR: answers,
  };
}
function io(): CliIo & { out: string[]; err: string[] } {
  const rec = { out: [] as string[], err: [] as string[] };
  return { ...rec, stdout: (t: string): void => { rec.out.push(t); }, stderr: (t: string): void => { rec.err.push(t); } };
}
const deps = (cwd: string, e: Record<string, string> = {}): CliDeps => ({ env: e, now: () => 1791310149000, cwd, transport: null });

test("Main example 1: an unknown command, in process", async () => {
  const o = io();
  const code: ExitCode = await main(["frobnicate"], deps("/"), o);
  expect(code).toBe(4);
  expect(o.out).toStrictEqual(['{"error":{"code":4,"kind":"UsageError","message":"unknown command: frobnicate"}}\n']);
  expect(o.err).toStrictEqual(["morph: unknown command: frobnicate\n"]);
});

test("Main example 2: deck check with --root and --pretty, one document", async () => {
  const r = tmpRoot();
  try {
    r.write("d.json", fixture("decks/hazardsWriteWrite.json"));
    const o = io();
    expect(await main(["deck", "check", "--deck", "d.json", "--root", r.root, "--pretty"], deps("/"), o)).toBe(2);
    expect(o.out.length).toBe(1);
    expect(o.out[0].startsWith('{\n  "deck": "d.json",\n  "cards": 2,')).toBe(true);
    expect((JSON.parse(o.out[0]) as { errors: number }).errors).toBe(1);
    expect(o.err).toStrictEqual(["morph deck check: exit 2\n"]);
  } finally {
    r.rm();
  }
});

test("Main example 3: a thrown fault is exit 3 (run outside a git repository)", async () => {
  const r = tmpRoot();
  const side = tmpRoot();
  try {
    side.write("answers/a.md", "```ts\nexport const a = 1;\n```\n");
    side.write("deck.json", JSON.stringify([{ customId: "a", intent: "generate", targets: ["out/a.ts"], instruction: "x" }]));
    const o = io();
    const code = await main(["run", "--root", r.root, "--deck", side.path("deck.json"), "--processor", "s", "--run-id", "r1"],
      deps(r.root, env(r.root, side.path("answers"))), o);
    expect(code).toBe(3);
    const doc = JSON.parse(o.out[0]) as { error: { code: number; kind: string; message: string } };
    expect(`${o.out.length} ${doc.error.code} ${doc.error.kind}`).toBe("1 3 RuntimeError");
    expect(doc.error.message.startsWith("git status failed (exit 128): "), doc.error.message).toBe(true);
    expect(o.err).toStrictEqual(["morph run: exit 3\n"]);
  } finally {
    r.rm();
    side.rm();
  }
});

test("Main example 4: the built binary runs a deck on the stub in a tmp repo, exit 0", () => {
  const r = tmpRepo();
  const side = tmpRoot();
  try {
    side.write("answers/a.md", "```ts\nexport const a = 1;\n```\n");
    side.write("answers/b.md", "```ts\nexport const b = 2;\n```\n");
    side.write("deck.json", JSON.stringify([
      { customId: "a", intent: "generate", targets: ["out/a.ts"], instruction: "x", acceptance: "test -f out/a.ts" },
      { customId: "b", intent: "generate", targets: ["out/b.ts"], instruction: "x", acceptance: "grep -q 'b = 2' out/b.ts",
        dependsOn: ["a"] }]));
    const p = spawnSync(process.execPath, [path.join(out.root, "cli.js"), "run", "--root", r.root, "--deck",
      side.path("deck.json"), "--processor", "s", "--run-id", "e2e"], { cwd: side.root, env: env(r.root, side.path("answers")),
      encoding: "utf8" });
    expect(p.status, p.stderr).toBe(0);
    expect(p.stdout.endsWith("}\n") && p.stdout.indexOf("\n") === p.stdout.length - 1, "one line").toBe(true);
    const doc = JSON.parse(p.stdout) as { runId: string; branch: string; report: { outcomes: { status: string }[] }; archive: { ok: boolean } };
    expect(`${doc.runId} ${doc.branch} ${doc.report.outcomes.map((o) => o.status).join(",")} ${doc.archive.ok}`).toBe(
      "e2e morph/e2e written,written true");
    expect(r.git(["log", "--format=%s", "-3"])).toBe("morph run e2e: deck and report\nmorph b: out/b.ts\nmorph a: out/a.ts");
    expect(p.stderr).toBe("morph run: exit 0\n");
  } finally {
    r.rm();
    side.rm();
  }
});

test("Main example 5: the built binary on a bad command, exit 4, one line", () => {
  const p = spawnSync(process.execPath, [path.join(out.root, "cli.js"), "frobnicate"], { encoding: "utf8", env: { PATH: process.env.PATH ?? "" } });
  expect(p.status).toBe(4);
  expect(p.stdout).toBe('{"error":{"code":4,"kind":"UsageError","message":"unknown command: frobnicate"}}\n');
});

test("§2.2: --pretty on a parse error; root resolved against cwd; a not-yet command", async () => {
  const o = io();
  expect(await main(["plan", "--pretty"], deps("/"), o)).toBe(4);
  expect(o.out).toStrictEqual(['{\n  "error": {\n    "code": 4,\n    "kind": "NotYetError",\n    "message": "command plan is not available yet"\n  }\n}\n']);
  const r = tmpRoot();
  try {
    r.write("sub/d.json", fixture("decks/tiny.json"));
    const o2 = io();
    expect(await main(["deck", "check", "--root", "sub", "--deck", "d.json"], deps(r.root), o2)).toBe(0);
    expect((JSON.parse(o2.out[0]) as { weights: { missing: string[] }[] }).weights[0].missing.join(",")).toBe("src/a.ts");
    expect(o2.out[0].split("\n").length, "compact").toBe(2);
  } finally {
    r.rm();
  }
});

test("§2.2: the built binary keeps the env it was given (processor from env only)", () => {
  const r = tmpRepo();
  const side = tmpRoot();
  try {
    side.write("deck.json", JSON.stringify([{ customId: "a", intent: "generate", targets: ["out/a.ts"], instruction: "x" }]));
    const p = spawnSync(process.execPath, [path.join(out.root, "cli.js"), "run", "--root", r.root, "--deck", side.path("deck.json"),
      "--processor", "s"], { encoding: "utf8", env: { PATH: process.env.PATH ?? "", HOME: r.root } });
    expect(p.status).toBe(4);
    expect(p.stdout).toBe('{"error":{"code":4,"kind":"UsageError","message":"processor s is not configured"}}\n');
  } finally {
    r.rm();
    side.rm();
  }
});

test("§2.2: the types", () => {
  expectTypeOf(main).toEqualTypeOf<(argv: string[], deps: CliDeps, io: CliIo) => Promise<ExitCode>>();
  expectTypeOf<CliIo>().toEqualTypeOf<{ stdout(text: string): void; stderr(text: string): void }>();
});

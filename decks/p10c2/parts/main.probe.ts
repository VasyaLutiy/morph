// P10c2 probe for main: a run's variant lines reach io.stderr by docs/TASK_P10c2_runner.md §2.2 (issue #3 C4) — main
// gives Run Command io.stderr as its log, so stderr carries one line per variant during the run, then the exit line;
// stdout keeps one document. Main in process on a stub deck, then the rows that must not change.
import { test, expect } from "vitest";
import { main } from "../../src/cli/main.js";
import type { CliDeps, CliIo } from "../../src/cli/types.js";
import { tmpRepo, tmpRoot } from "../../tests/helpers.js";

function env(home: string, answers: string): Record<string, string> {
  return {
    PATH: process.env.PATH ?? "", HOME: home, GIT_CONFIG_NOSYSTEM: "1",
    GIT_AUTHOR_NAME: "Ada", GIT_AUTHOR_EMAIL: "ada@example.invalid",
    GIT_COMMITTER_NAME: "Ada", GIT_COMMITTER_EMAIL: "ada@example.invalid",
    MORPH_PROCESSOR_s_TYPE: "stub", MORPH_PROCESSOR_s_ANSWERS_DIR: answers,
  };
}
function io(): { io: CliIo; out: string[]; err: string[] } {
  const out: string[] = [];
  const err: string[] = [];
  return { io: { stdout: (t) => { out.push(t); }, stderr: (t) => { err.push(t); } }, out, err };
}
const ANSWER = "```ts\nexport const a = 1;\n```\n";

test("Main: a run's variant lines go to stderr, in order, before the exit line; stdout one document", async () => {
  const r = tmpRepo();
  const side = tmpRoot();
  try {
    side.write("answers/a.md", ANSWER);
    side.write("answers/b.v1.md", ANSWER);
    side.write("deck.json", JSON.stringify([
      { customId: "a", intent: "generate", targets: ["out/a.ts"], instruction: "x", acceptance: "echo '== tsc'; test -f out/a.ts" },
      { customId: "b", intent: "generate", targets: ["out/b.ts"], instruction: "x", acceptance: "exit 1", dependsOn: ["a"], variants: 2 }]));
    const deps: CliDeps = { env: env(r.root, side.path("answers")), now: () => 0, cwd: r.root, transport: null };
    const o = io();
    const code = await main(["run", "--root", r.root, "--deck", side.path("deck.json"), "--processor", "s", "--run-id", "m1",
      "--max-retry-batches", "0"], deps, o.io);
    expect(code, o.out.join("")).toBe(1);
    expect(o.err, "stderr").toStrictEqual([
      "morph run: a.v1 accepted stage 1 tsc finish stop chars 30\n",
      "morph run: b.v1 rejected stage 0 finish stop chars 30\n",
      "morph run: b.v2 corrupt stage 0 finish none chars none\n",
      "morph run: exit 1\n"]);
    expect(o.out.length, "one document").toBe(1);
    expect((JSON.parse(o.out[0] ?? "{}") as { runId: string }).runId, "runId").toBe("m1");
    expect(`${r.exists(".morph/runs/m1/answers/b.v2.request.json")} ${r.exists(".morph/runs/m1/answers/b.v2.answer.txt")}`, "archived")
      .toBe("true false");
  } finally {
    r.rm();
    side.rm();
  }
});

test("Main: deck check and a usage error keep their one stderr line", async () => {
  const o = io();
  const deps: CliDeps = { env: {}, now: () => 0, cwd: "/", transport: null };
  expect(await main(["frobnicate"], deps, o.io), "usage").toBe(4);
  expect(o.err, "stderr").toStrictEqual(["morph: unknown command: frobnicate\n"]);
  const t = tmpRoot();
  try {
    t.write("d.json", JSON.stringify([{ customId: "a", intent: "generate", targets: ["src/a.ts"], instruction: "x" }]));
    const p = io();
    expect(await main(["deck", "check", "--root", t.root, "--deck", "d.json"], deps, p.io), "deck check").toBe(0);
    expect(p.err, "stderr").toStrictEqual(["morph deck check: exit 0\n"]);
  } finally {
    t.rm();
  }
});

test("Main: a run that fails before the deck runs prints no variant line", async () => {
  const t = tmpRoot();
  try {
    t.write("answers/a.md", ANSWER);
    t.write("deck.json", JSON.stringify([{ customId: "a", intent: "generate", targets: ["out/a.ts"], instruction: "x", acceptance: "true" }]));
    const o = io();
    const deps: CliDeps = { env: env(t.root, t.path("answers")), now: () => 0, cwd: t.root, transport: null };
    expect(await main(["run", "--deck", "deck.json", "--processor", "s", "--run-id", "r1"], deps, o.io), "not a repo").toBe(3);
    expect(o.err, "stderr").toStrictEqual(["morph run: exit 3\n"]);
  } finally {
    t.rm();
  }
});

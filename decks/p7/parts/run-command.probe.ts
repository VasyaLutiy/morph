// P7 probe for run-command: runCommand by docs/TASK_P7_cli.md §2.2, one test per record example
// (Component cli, Function Run Command 1-6), then the §2.2 rows (checks before any branch, the
// budget, the transport left alone on the stub) and the types. Every repo is a tmpRepo; the deck file
// and the stub answers live in a separate tmpRoot so the repo tree stays clean.
import { test, expect, expectTypeOf } from "vitest";
import { mintRunId, runCommand } from "../../src/cli/runCommand.js";
import type { CliDeps, CommandResult, RunArgs, RunDocument } from "../../src/cli/types.js";
import type { Transport } from "../../src/processor/types.js";
import { tmpRepo, tmpRoot } from "../../tests/helpers.js";
import type { TmpRepo, TmpRoot } from "../../tests/helpers.js";

function env(home: string, answers: string): Record<string, string> {
  return {
    PATH: process.env.PATH ?? "", HOME: home, GIT_CONFIG_NOSYSTEM: "1",
    GIT_AUTHOR_NAME: "Ada", GIT_AUTHOR_EMAIL: "ada@example.invalid",
    GIT_COMMITTER_NAME: "Ada", GIT_COMMITTER_EMAIL: "ada@example.invalid",
    MORPH_PROCESSOR_s_TYPE: "stub", MORPH_PROCESSOR_s_ANSWERS_DIR: answers,
  };
}
function card(id: string, acceptance: string, dependsOn: string[] = [], target = `out/${id}.ts`): Record<string, unknown> {
  return { customId: id, intent: "generate", targets: [target], instruction: "x", acceptance, dependsOn };
}
function setup(cards: Record<string, unknown>[]): { r: TmpRepo; side: TmpRoot; deps: CliDeps; deck: string } {
  const r = tmpRepo();
  const side = tmpRoot();
  for (const c of cards) side.write(`answers/${String(c.customId)}.md`, "```ts\nexport const " + String(c.customId) + " = 1;\n```\n");
  const deck = side.write("deck.json", JSON.stringify(cards));
  const deps: CliDeps = { env: env(r.root, side.path("answers")), now: () => 1791310149000, cwd: r.root, transport: null };
  return { r, side, deps, deck };
}
const args = (deck: string, extra: Partial<RunArgs> = {}): RunArgs => ({
  name: "run", root: ".", pretty: false, deck, processor: "s", runId: "r1", deadlineSeconds: 2400, maxCards: null,
  maxRetryBatches: 0, ...extra,
});
const errorOf = (got: CommandResult): string => JSON.stringify(got);

test("Run Command example 1: two generations on the stub, committed and archived, exit 0", async () => {
  const { r, side, deps, deck } = setup([card("a", "test -f out/a.ts"), card("b", "test -f out/b.ts", ["a"])]);
  try {
    const base = r.git(["rev-parse", "HEAD"]);
    const got = await runCommand(r.root, args(deck), deps);
    const doc = got.document as RunDocument;
    expect(got.code, errorOf(got)).toBe(0);
    expect(`${doc.runId} ${doc.branch} ${doc.base === base}`).toBe("r1 morph/r1 true");
    expect(doc.report.outcomes.map((o) => `${o.customId}:${o.status}`).join(" ")).toBe("a:written b:written");
    expect(`${doc.report.generations} ${doc.report.processor} ${doc.report.usageTotals.requests}`).toBe("2 s 2");
    expect(doc.archive).toStrictEqual({ ok: true, dir: ".morph/runs/r1", commit: r.git(["rev-parse", "HEAD"]) });
    expect(r.git(["log", "--format=%s", base + "..HEAD"])).toBe("morph run r1: deck and report\nmorph b: out/b.ts\nmorph a: out/a.ts");
    expect(r.git(["rev-parse", "--abbrev-ref", "HEAD"])).toBe("morph/r1");
    expect(r.git(["log", "-1", "--format=%an", "HEAD~1"])).toBe("Ada");
    expect(r.git(["log", "-1", "--format=%(trailers:key=Morph-Model,valueonly)", "HEAD~1"])).toBe("stub");
    expect(r.git(["status", "--porcelain"])).toBe("");
  } finally {
    r.rm();
    side.rm();
  }
});

test("Run Command example 2: a failed card is exit 1, archived with Morph-Failed: 1", async () => {
  const { r, side, deps, deck } = setup([card("a", "exit 1")]);
  try {
    const got = await runCommand(r.root, args(deck), deps);
    const doc = got.document as RunDocument;
    expect(got.code, errorOf(got)).toBe(1);
    expect(`${doc.report.outcomes[0].status} ${doc.report.outcomes[0].reason}`).toBe("failed acceptance failed");
    expect(doc.archive.ok).toBe(true);
    expect(r.git(["log", "-1", "--format=%(trailers:key=Morph-Failed,valueonly)"])).toBe("1");
    expect(r.exists("out/a.ts"), "the rejected answer rolled back").toBe(false);
  } finally {
    r.rm();
    side.rm();
  }
});

test("Run Command example 3: an unconfigured processor is exit 4 before any git", async () => {
  const { r, side, deps, deck } = setup([card("a", "true")]);
  try {
    const got = await runCommand(r.root, args(deck, { processor: "nope" }), deps);
    expect(got).toStrictEqual({ code: 4, document: { error: { code: 4, kind: "UsageError", message: "processor nope is not configured" } } });
    const bad: CliDeps = { ...deps, env: { ...deps.env, MORPH_PROCESSOR_bad_TYPE: "x" } };
    expect(await runCommand(r.root, args(deck, { processor: "bad" }), bad)).toStrictEqual({ code: 4, document: { error: { code: 4,
      kind: "UsageError", message: "processor bad is not configured: MORPH_PROCESSOR_bad_TYPE must be one of openrouter, stub (got 'x')" } } });
    expect(r.git(["branch", "--list", "morph/*"])).toBe("");
  } finally {
    r.rm();
    side.rm();
  }
});

test("Run Command example 4: a dirty tree is refused with exit 2, the checkout unchanged", async () => {
  const { r, side, deps, deck } = setup([card("a", "true")]);
  try {
    r.write("notes.txt", "n\n");
    expect(await runCommand(r.root, args(deck), deps)).toStrictEqual({ code: 2, document: { error: { code: 2,
      kind: "RefusalError", message: "dirty tree outside .morph/: notes.txt" } } });
    expect(r.git(["rev-parse", "--abbrev-ref", "HEAD"])).toBe("main");
    expect(r.exists(".morph/runs/r1"), "no archive").toBe(false);
  } finally {
    r.rm();
    side.rm();
  }
});

test("Run Command example 5: a deck with a write-write hazard is refused with exit 2, no branch", async () => {
  const { r, side, deps, deck } = setup([card("a", "true", [], "out/x.ts"), card("b", "true", [], "out/x.ts")]);
  try {
    expect(await runCommand(r.root, args(deck), deps)).toStrictEqual({ code: 2, document: { error: { code: 2,
      kind: "RefusalError", message: "deck has 1 hazard error(s): write-write a,b out/x.ts" } } });
    expect(r.git(["branch", "--list", "morph/*"])).toBe("");
  } finally {
    r.rm();
    side.rm();
  }
});

test("Run Command example 6: no --run-id mints one from now() in UTC", async () => {
  const { r, side, deps, deck } = setup([card("a", "test -f out/a.ts")]);
  try {
    expect(mintRunId(1791310149000)).toBe("20261006-180909");
    const got = await runCommand(r.root, args(deck, { runId: null }), deps);
    const doc = got.document as RunDocument;
    expect(`${got.code} ${doc.runId} ${doc.branch} ${doc.report.runId}`).toBe("0 20261006-180909 morph/20261006-180909 20261006-180909");
    expect(r.exists(".morph/runs/20261006-180909/report.json")).toBe(true);
  } finally {
    r.rm();
    side.rm();
  }
});

test("§2.2: order of the refusals — processor, deck file, hazards, branch; an existing branch", async () => {
  const { r, side, deps, deck } = setup([card("a", "true")]);
  try {
    r.write("notes.txt", "n\n");
    const p = await runCommand(r.root, args("missing.json", { processor: "nope" }), deps);
    expect(errorOf(p)).toContain("processor nope is not configured");
    const d = await runCommand(r.root, args("missing.json"), deps);
    expect(d).toStrictEqual({ code: 4, document: { error: { code: 4, kind: "UsageError", message: "deck file not found: missing.json" } } });
    side.write("cyc.json", JSON.stringify([card("a", "true", ["b"]), card("b", "true", ["a"])]));
    const c = await runCommand(r.root, args(side.path("cyc.json")), deps);
    expect(errorOf(c)).toContain('"code":2,"kind":"DeckError","message":"invalid deck: dependsOn: dependsOn cycle a -> b -> a"');
    r.git(["add", "notes.txt"]);
    r.git(["commit", "-q", "-m", "notes"]);
    r.git(["branch", "morph/r1"]);
    expect(await runCommand(r.root, args(deck), deps)).toStrictEqual({ code: 2, document: { error: { code: 2,
      kind: "RefusalError", message: "branch morph/r1 already exists" } } });
    expect(await runCommand(r.root, args(deck, { runId: "x" }), deps), "untracked .morph/ is clean").toMatchObject({ code: 0 });
  } finally {
    r.rm();
    side.rm();
  }
});

test("§2.2: the budget — deadline from the first now(), maxCards default and given; the transport untouched", async () => {
  const { r, side, deps, deck } = setup([card("a", "test -f out/a.ts"), card("b", "test -f out/b.ts", ["a"])]);
  try {
    let t = 1000;
    const calls: string[] = [];
    const transport: Transport = {
      fetch: () => { calls.push("fetch"); return Promise.reject(new Error("no")); },
      sleep: () => { calls.push("sleep"); return Promise.resolve(); },
    };
    const clock: CliDeps = { ...deps, transport, now: () => { const v = t; t += 600; return v; } };
    const got = await runCommand(r.root, args(deck, { deadlineSeconds: 1 }), clock);
    const doc = got.document as RunDocument;
    expect(doc.report.outcomes.map((o) => `${o.customId}:${o.status}:${o.reason}`).join(" ")).toBe("a:written:null b:budget-exceeded:deadline");
    expect(`${got.code} ${calls.length}`).toBe("1 0");
    const r2 = await runCommand(r.root, args(deck, { runId: "r2", maxCards: 1 }), deps);
    const doc2 = r2.document as RunDocument;
    expect(doc2.report.outcomes.map((o) => `${o.customId}:${o.status}:${o.reason}`).join(" ")).toBe("a:written:null b:budget-exceeded:maxCards 1");
  } finally {
    r.rm();
    side.rm();
  }
});

test("§2.2: a retry batch when --max-retry-batches allows it", async () => {
  const { r, side, deps, deck } = setup([card("a", "test -f /nonexistent-marker")]);
  try {
    const got = await runCommand(r.root, args(deck, { maxRetryBatches: 1 }), deps);
    const doc = got.document as RunDocument;
    expect(`${got.code} ${doc.report.outcomes[0].attempts} ${doc.report.usageTotals.requests}`).toBe("1 2 2");
  } finally {
    r.rm();
    side.rm();
  }
});

test("§2.2: the types", () => {
  expectTypeOf(runCommand).toEqualTypeOf<(root: string, args: RunArgs, deps: CliDeps) => Promise<CommandResult>>();
  expectTypeOf(mintRunId).toEqualTypeOf<(ms: number) => string>();
  expectTypeOf<CliDeps>().toEqualTypeOf<{ env: Record<string, string>; now: () => number; cwd: string; transport: Transport | null }>();
  expectTypeOf<RunDocument>().toHaveProperty("archive");
});

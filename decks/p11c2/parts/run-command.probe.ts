// P11c2 probe for run-command by docs/TASK_P11c2_runner.md §2.2 (issue #5 findings 4 and 6) — after the hazard check,
// cards whose acceptance is null or blank refuse the run (code 2, "deck has <n> card(s) with no acceptance: <ids>",
// before any git call); deps.interrupted reaches Run Deck, so a stop is the fault: code 3, the partial report archived.
// Record Run Command example 12, then the §2.2 rows.
import { test, expect } from "vitest";
import { runCommand } from "../../src/cli/runCommand.js";
import type { CliDeps, CommandResult, RunArgs, RunDocument } from "../../src/cli/types.js";
import { tmpRepo, tmpRoot } from "../../tests/helpers.js";
import type { TmpRepo, TmpRoot } from "../../tests/helpers.js";

function gitEnv(home: string): Record<string, string> {
  return {
    PATH: process.env.PATH ?? "", HOME: home, GIT_CONFIG_NOSYSTEM: "1",
    GIT_AUTHOR_NAME: "Ada", GIT_AUTHOR_EMAIL: "ada@example.invalid",
    GIT_COMMITTER_NAME: "Ada", GIT_COMMITTER_EMAIL: "ada@example.invalid",
  };
}
const ANSWER = "```ts\nexport const a = 1;\n```\n";
const args = (deck: string, runId: string): RunArgs => ({
  name: "run", root: ".", pretty: false, deck, processor: "s", runId, deadlineSeconds: 2400, maxCards: null, maxRetryBatches: 1 });
const refusal = (message: string): CommandResult => ({ code: 2, document: { error: { code: 2, kind: "RefusalError", message } } });
function setup(cards: unknown[]): { r: TmpRepo; side: TmpRoot; deps: CliDeps; deck: string } {
  const r = tmpRepo();
  const side = tmpRoot();
  for (const name of ["a.md", "b.md", "x.md"]) side.write(`answers/${name}`, ANSWER);
  const deck = side.write("deck.json", JSON.stringify(cards));
  const deps: CliDeps = { env: { ...gitEnv(r.root), MORPH_PROCESSOR_s_TYPE: "stub", MORPH_PROCESSOR_s_ANSWERS_DIR: side.path("answers") },
    now: () => 1791310149000, cwd: r.root, transport: null };
  return { r, side, deps, deck };
}
const c = (customId: string, target: string, extra: Record<string, unknown> = {}): Record<string, unknown> =>
  ({ customId, intent: "generate", targets: [target], instruction: "x", ...extra });

test("Run Command example 12: cards with no acceptance refuse the run before any git call", async () => {
  const { r, side, deps, deck } = setup([c("x", "out/x.ts", { acceptance: "true" }), c("q", "out/q.ts"), c("d", "out/d.ts", { acceptance: " \n" })]);
  try {
    const got = await runCommand(r.root, args(deck, "r12"), deps);
    expect(got, "the refusal").toStrictEqual(refusal("deck has 2 card(s) with no acceptance: q,d"));
    expect(`${r.git(["for-each-ref", "refs/heads/morph/*"])}|${r.exists(".morph")}|${r.git(["symbolic-ref", "--short", "HEAD"])}`, "no git call")
      .toBe("|false|main");
  } finally {
    r.rm();
    side.rm();
  }
});

test("§2.2 rows: one card, a tab; hazard errors still come first", async () => {
  const one = setup([c("t", "out/t.ts", { acceptance: "\t" })]);
  try {
    expect(await runCommand(one.r.root, args(one.deck, "r12"), one.deps), "n = 1").toStrictEqual(refusal("deck has 1 card(s) with no acceptance: t"));
  } finally {
    one.r.rm();
    one.side.rm();
  }
  const both = setup([c("a", "out/x.ts"), c("b", "out/x.ts"), c("e", "out/e.ts", { acceptance: "" })]);
  try {
    expect(await runCommand(both.r.root, args(both.deck, "r12"), both.deps), "hazard first")
      .toStrictEqual(refusal("deck has 1 hazard error(s): write-write a,b out/x.ts"));
  } finally {
    both.r.rm();
    both.side.rm();
  }
});

test("§2.2 rows: deps.interrupted reaches Run Deck — code 3, fault, the partial report archived", async () => {
  const { r, side, deps, deck } = setup([c("a", "out/a.ts", { acceptance: "test -f out/a.ts" }),
    c("b", "out/b.ts", { acceptance: "test -f out/b.ts", dependsOn: ["a"] })]);
  try {
    const base = r.git(["rev-parse", "HEAD"]);
    const got = await runCommand(r.root, args(deck, "p6"), { ...deps, interrupted: () => "SIGTERM" });
    const doc = got.document as RunDocument;
    expect(`${got.code} ${doc.report.fault}`, JSON.stringify(got).slice(0, 600)).toBe("3 interrupted by SIGTERM");
    expect(doc.report.outcomes.map((o) => `${o.customId} ${o.status} ${o.reason}`).join("; "), "outcomes").toBe("a skipped fault; b skipped fault");
    expect(`${doc.report.usageTotals.requests} ${doc.archive.ok} ${doc.archive.dir}`, "no spend, archive").toBe("0 true .morph/runs/p6");
    expect(`${r.git(["rev-list", "--count", base + "..HEAD"])} ${r.git(["symbolic-ref", "--short", "HEAD"])}`, "one archive commit").toBe("1 morph/p6");
    expect(r.read(".morph/runs/p6/report.json").includes("interrupted by SIGTERM"), "report.json holds the fault").toBe(true);
  } finally {
    r.rm();
    side.rm();
  }
});

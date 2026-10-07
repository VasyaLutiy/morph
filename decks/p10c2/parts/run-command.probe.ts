// P10c2 probe for run-command: the variant records of a run by docs/TASK_P10c2_runner.md §2.2 (issue #3 C4) — every
// Variant Record kept and archived under .morph/runs/<id>/answers/, one variantLine per variant to the optional log.
// Record Run Command examples 7-8, then the §2.2 rows (no log, the document unchanged, the types).
import { test, expect, expectTypeOf } from "vitest";
import { runCommand, variantLine } from "../../src/cli/runCommand.js";
import type { CliDeps, CommandResult, RunArgs, RunDocument } from "../../src/cli/types.js";
import type { Request } from "../../src/compiler/types.js";
import type { VariantRecord } from "../../src/runloop/types.js";
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
const ANSWER = "```ts\nexport const a = 1;\n```\n";
function setup(acceptance: string, answers: string[]): { r: TmpRepo; side: TmpRoot; deps: CliDeps; deck: string } {
  const r = tmpRepo();
  const side = tmpRoot();
  for (const name of answers) side.write(`answers/${name}`, ANSWER);
  const deck = side.write("deck.json", JSON.stringify([
    { customId: "a", intent: "generate", targets: ["out/a.ts"], instruction: "x", acceptance, dependsOn: [] }]));
  const deps: CliDeps = { env: env(r.root, side.path("answers")), now: () => 1791310149000, cwd: r.root, transport: null };
  return { r, side, deps, deck };
}
const args = (deck: string, extra: Partial<RunArgs> = {}): RunArgs => ({
  name: "run", root: ".", pretty: false, deck, processor: "s", runId: "r1", deadlineSeconds: 2400, maxCards: null,
  maxRetryBatches: 1, ...extra,
});
const errorOf = (got: CommandResult): string => JSON.stringify(got);
const request = (customId: string): Request => ({ customId, model: null, maxTokens: null, reasoning: null, messages: [] });

test("Run Command example 7: variantLine names the variant, verdict, stage reached, finish reason and length", () => {
  const a: VariantRecord = { request: request("a.v1"), text: "x".repeat(30), finishReason: "stop", error: null,
    verdict: "rejected", stages: 4, lastStage: "probe" };
  const b: VariantRecord = { request: request("b.r1.v2"), text: null, finishReason: null, error: "boom",
    verdict: "corrupt", stages: 0, lastStage: null };
  expect(variantLine(a), "a").toBe("morph run: a.v1 rejected stage 4 probe finish stop chars 30\n");
  expect(variantLine(b), "b").toBe("morph run: b.r1.v2 corrupt stage 0 finish none chars none\n");
  expect(variantLine({ ...a, verdict: "truncated", stages: 0, lastStage: null, finishReason: "length", text: "" }), "empty text")
    .toBe("morph run: a.v1 truncated stage 0 finish length chars 0\n");
});

test("Run Command example 8: one log line per variant, retries included; answers/ archived with the run", async () => {
  const { r, side, deps, deck } = setup("exit 1", ["a.md", "a.r1.md"]);
  try {
    const base = r.git(["rev-parse", "HEAD"]);
    const log: string[] = [];
    const got = await runCommand(r.root, args(deck), deps, (text) => { log.push(text); });
    expect(got.code, errorOf(got)).toBe(1);
    expect(log, "log").toStrictEqual(["morph run: a.v1 rejected stage 0 finish stop chars 30\n",
      "morph run: a.r1.v1 rejected stage 0 finish stop chars 30\n"]);
    const d = ".morph/runs/r1/";
    expect(r.git(["show", "--name-only", "--format=", "HEAD"]), "archive commit").toBe([d + "answers/a.r1.v1.answer.txt",
      d + "answers/a.r1.v1.request.json", d + "answers/a.v1.answer.txt", d + "answers/a.v1.request.json", d + "deck.json",
      d + "report.json"].join("\n"));
    expect(r.read(d + "answers/a.v1.answer.txt"), "raw answer").toBe(ANSWER);
    const retry = JSON.parse(r.read(d + "answers/a.r1.v1.request.json")) as Request;
    expect(retry.customId, "retry id").toBe("a.r1.v1");
    expect(retry.messages[retry.messages.length - 1]?.content.includes("<acceptance_output>"), "retry prompt").toBe(true);
    const first = JSON.parse(r.read(d + "answers/a.v1.request.json")) as Request;
    expect(first.messages.some((m) => m.content.includes("<acceptance_output>")), "first prompt").toBe(false);
    expect(r.git(["log", "--format=%s", base + "..HEAD"]), "subjects").toBe("morph run r1: deck and report");
    expect(r.git(["status", "--porcelain"]), "clean").toBe("");
  } finally {
    r.rm();
    side.rm();
  }
});

test("§2.2: without a log nothing is printed, the answers are still archived; the document keeps its keys", async () => {
  const { r, side, deps, deck } = setup("test -f out/a.ts", ["a.md"]);
  try {
    const got = await runCommand(r.root, args(deck), deps);
    expect(got.code, errorOf(got)).toBe(0);
    const doc = got.document as RunDocument;
    expect(Object.keys(doc).join(" "), "keys").toBe("runId branch base report archive");
    expect(doc.archive, "archive").toStrictEqual({ ok: true, dir: ".morph/runs/r1", commit: r.git(["rev-parse", "HEAD"]) });
    expect(r.exists(".morph/runs/r1/answers/a.v1.request.json") && r.exists(".morph/runs/r1/answers/a.v1.answer.txt"), "answers").toBe(true);
    expect(r.git(["status", "--porcelain"]), "clean").toBe("");
  } finally {
    r.rm();
    side.rm();
  }
});

test("§2.2: a refusal before the run logs nothing and archives nothing", async () => {
  const { r, side, deps, deck } = setup("true", ["a.md"]);
  try {
    r.write("notes.txt", "x\n");
    const log: string[] = [];
    const got = await runCommand(r.root, args(deck), deps, (text) => { log.push(text); });
    expect(got.code, errorOf(got)).toBe(2);
    expect(`${log.length} ${r.exists(".morph/runs/r1")}`, "nothing").toBe("0 false");
  } finally {
    r.rm();
    side.rm();
  }
});

test("§2.2: the types — variantLine, runCommand's optional log", () => {
  expectTypeOf(variantLine).toEqualTypeOf<(record: VariantRecord) => string>();
  expectTypeOf(runCommand).parameter(3).toEqualTypeOf<((text: string) => void) | undefined>();
});

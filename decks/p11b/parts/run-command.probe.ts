// P11b probe for run-command: the run's wiring by docs/TASK_P11b_processor.md §2.2 (issue #4 operator decision, item 2)
// — every kept record carries its variantLine (archived as answers/lines.txt), the request copies only under the ignored
// requests/, and the transport gets saveBatch → git's saveBatchRecord(root, record), whatever transport deps give.
// Record Run Command examples 8-9, then the §2.2 rows.
import { test, expect } from "vitest";
import fs from "node:fs";
import { gunzipSync } from "node:zlib";
import { runCommand } from "../../src/cli/runCommand.js";
import type { CliDeps, CommandResult, RunArgs, RunDocument } from "../../src/cli/types.js";
import type { Request } from "../../src/compiler/types.js";
import type { Transport } from "../../src/processor/types.js";
import { fixture, tmpRepo, tmpRoot } from "../../tests/helpers.js";
import type { TmpRepo, TmpRoot } from "../../tests/helpers.js";

const LIVE = "batch-1791388269-cp5qOr5IQ0xoz1ntuc8W";
function gitEnv(home: string): Record<string, string> {
  return {
    PATH: process.env.PATH ?? "", HOME: home, GIT_CONFIG_NOSYSTEM: "1",
    GIT_AUTHOR_NAME: "Ada", GIT_AUTHOR_EMAIL: "ada@example.invalid",
    GIT_COMMITTER_NAME: "Ada", GIT_COMMITTER_EMAIL: "ada@example.invalid",
  };
}
const ANSWER = "```ts\nexport const a = 1;\n```\n";
const args = (deck: string, processor: string, runId: string, maxRetryBatches = 1): RunArgs => ({
  name: "run", root: ".", pretty: false, deck, processor, runId, deadlineSeconds: 2400, maxCards: null, maxRetryBatches });
const errorOf = (got: CommandResult): string => JSON.stringify(got);
function stubSetup(acceptance: string, answers: string[]): { r: TmpRepo; side: TmpRoot; deps: CliDeps; deck: string } {
  const r = tmpRepo();
  const side = tmpRoot();
  for (const name of answers) side.write(`answers/${name}`, ANSWER);
  const deck = side.write("deck.json", JSON.stringify([
    { customId: "a", intent: "generate", targets: ["out/a.ts"], instruction: "x", acceptance, dependsOn: [] }]));
  const deps: CliDeps = { env: { ...gitEnv(r.root), MORPH_PROCESSOR_s_TYPE: "stub", MORPH_PROCESSOR_s_ANSWERS_DIR: side.path("answers") },
    now: () => 1791310149000, cwd: r.root, transport: null };
  return { r, side, deps, deck };
}
function batchTransport(): Transport {
  let n = 0;
  return {
    fetch: async () => { n += 1; const name = n === 1 ? "batchSubmittedLive.json" : "batchCompletedLive.json";
      return { status: n === 1 ? 202 : 200, text: async () => fixture("processor/" + name) }; },
    sleep: async () => {},
  };
}

test("Run Command example 8: lines.txt and the answers committed; the request copies gzipped, not committed", async () => {
  const { r, side, deps, deck } = stubSetup("exit 1", ["a.md", "a.r1.md"]);
  try {
    const log: string[] = [];
    const got = await runCommand(r.root, args(deck, "s", "r1"), deps, (text) => { log.push(text); });
    expect(got.code, errorOf(got)).toBe(1);
    const lines = ["morph run: a.v1 rejected stage 0 finish stop chars 30\n", "morph run: a.r1.v1 rejected stage 0 finish stop chars 30\n"];
    expect(log, "log").toStrictEqual(lines);
    const d = ".morph/runs/r1/";
    expect(r.git(["show", "--name-only", "--format=", "HEAD"]), "archive commit").toBe([d + "answers/a.r1.v1.answer.txt",
      d + "answers/a.v1.answer.txt", d + "answers/lines.txt", d + "deck.json", d + "report.json"].join("\n"));
    expect(r.read(d + "answers/lines.txt"), "lines.txt").toBe(lines.join(""));
    const retry = JSON.parse(gunzipSync(fs.readFileSync(r.path(d + "requests/a.r1.v1.request.json.gz"))).toString("utf8")) as Request;
    expect(retry.messages[retry.messages.length - 1]?.content.includes("<acceptance_output>"), "retry prompt").toBe(true);
    expect(r.git(["status", "--porcelain"]), "clean").toBe("");
  } finally {
    r.rm();
    side.rm();
  }
});

test("Run Command example 9: a batch-route run; the record file, the rows' batch id, the cost", async () => {
  const r = tmpRepo();
  const side = tmpRoot();
  try {
    const deck = side.write("deck.json", JSON.stringify([
      { customId: "clamp-value", intent: "generate", targets: ["out/clamp.ts"], instruction: "x", acceptance: "test -f out/clamp.ts" },
      { customId: "sign-of", intent: "generate", targets: ["out/sign.ts"], instruction: "x", acceptance: "test -f out/sign.ts" }]));
    const deps: CliDeps = { env: { ...gitEnv(r.root), MORPH_PROCESSOR_b_TYPE: "openrouter", MORPH_PROCESSOR_b_MODEL: "acme/m:batch",
      MORPH_PROCESSOR_b_API_KEY: "k", MORPH_PROCESSOR_b_ROUTE: "batch", MORPH_PROCESSOR_b_TIMEOUT_MS: "30000" },
      now: () => 1791310149000, cwd: r.root, transport: batchTransport() };
    const got = await runCommand(r.root, args(deck, "b", "r9", 0), deps);
    expect(got.code, errorOf(got)).toBe(0);
    const report = (got.document as RunDocument).report;
    expect(report.outcomes.map((o) => o.status).join(","), "written").toBe("written,written");
    expect((report.requests ?? []).map((q) => `${q.customId} ${q.model} ${q.batchId}`), "rows")
      .toStrictEqual([`clamp-value.v1 acme/m:batch ${LIVE}`, `sign-of.v1 acme/m:batch ${LIVE}`]);
    expect(report.usageTotals.cost, "cost").toBe(0.0005804);
    expect(r.read(`.morph/batches/${LIVE}.json`), "the record file exactly batch.r9.json").toBe(fixture("cli/batch.r9.json"));
    expect(r.read(".morph/runs/r9/answers/lines.txt").split("\n").filter(Boolean).map((l) => l.split(" ").slice(0, 4).join(" ")),
      "lines").toStrictEqual(["morph run: clamp-value.v1 accepted", "morph run: sign-of.v1 accepted"]);
    expect(r.git(["status", "--porcelain"]), "only the batch state is untracked").toBe("?? .morph/batches/");
  } finally {
    r.rm();
    side.rm();
  }
});

test("§2.2 rows: the stub route writes no batch file; without a log the lines are still archived", async () => {
  const { r, side, deps, deck } = stubSetup("test -f out/a.ts", ["a.md"]);
  try {
    const got = await runCommand(r.root, args(deck, "s", "r1"), deps);
    expect(got.code, errorOf(got)).toBe(0);
    expect(r.read(".morph/runs/r1/answers/lines.txt"), "lines").toBe("morph run: a.v1 accepted stage 0 finish stop chars 30\n");
    expect(`${r.exists(".morph/batches")} ${r.exists(".morph/runs/r1/answers/a.v1.request.json")}`, "no batches, no request.json").toBe("false false");
    expect(Object.keys(got.document as RunDocument).join(" "), "keys").toBe("runId branch base report archive");
    expect(r.git(["status", "--porcelain"]), "clean").toBe("");
  } finally {
    r.rm();
    side.rm();
  }
});

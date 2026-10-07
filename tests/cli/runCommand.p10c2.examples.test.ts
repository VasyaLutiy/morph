import { expect, test } from "vitest";
import { runCommand, variantLine } from "../../src/cli/runCommand.js";
import type { CliDeps, RunArgs } from "../../src/cli/types.js";
import type { VariantRecord } from "../../src/runloop/types.js";
import type { Request } from "../../src/compiler/types.js";
import { tmpRepo, tmpRoot } from "../helpers.js";
import type { TmpRepo, TmpRoot } from "../helpers.js";

test("Run Command example 7", () => {
  const requestA: Request = {
    customId: "a.v1",
    model: null,
    maxTokens: null,
    reasoning: null,
    messages: [{ role: "user", content: "write a" }]
  };
  const requestB: Request = {
    customId: "b.r1.v2",
    model: null,
    maxTokens: null,
    reasoning: null,
    messages: [{ role: "user", content: "write b" }]
  };
  const rejected: VariantRecord = {
    request: requestA,
    text: "```ts\nexport const a = 1;\n```\n",
    finishReason: "stop",
    error: null,
    verdict: "rejected",
    stages: 4,
    lastStage: "probe"
  };
  const corrupt: VariantRecord = {
    request: requestB,
    text: null,
    finishReason: null,
    error: null,
    verdict: "corrupt",
    stages: 0,
    lastStage: null
  };
  expect(variantLine(rejected)).toBe(
    "morph run: a.v1 rejected stage 4 probe finish stop chars 30\n"
  );
  expect(variantLine(corrupt)).toBe(
    "morph run: b.r1.v2 corrupt stage 0 finish none chars none\n"
  );
});

test("Run Command example 8", async () => {
  const r: TmpRepo = tmpRepo();
  const side: TmpRoot = tmpRoot("morph-p10c2-");
  try {
    const gitEnv = (home: string): Record<string, string> => ({
      PATH: process.env.PATH ?? "",
      HOME: home,
      GIT_CONFIG_NOSYSTEM: "1",
      GIT_AUTHOR_NAME: "Ada",
      GIT_AUTHOR_EMAIL: "ada@example.invalid",
      GIT_COMMITTER_NAME: "Ada",
      GIT_COMMITTER_EMAIL: "ada@example.invalid"
    });
    side.write(
      "deck.json",
      JSON.stringify([
        {
          customId: "a",
          intent: "generate",
          targets: ["out/a.ts"],
          instruction: "x",
          acceptance: "exit 1",
          dependsOn: []
        }
      ])
    );
    const answer = "```ts\nexport const a = 1;\n```\n";
    side.write("answers/a.md", answer);
    side.write("answers/a.r1.md", answer);
    const env: Record<string, string> = {
      ...gitEnv(side.root),
      MORPH_PROCESSOR_s_TYPE: "stub",
      MORPH_PROCESSOR_s_ANSWERS_DIR: side.path("answers")
    };
    const deps: CliDeps = {
      env,
      now: (): number => 1791310149000,
      cwd: r.root,
      transport: null
    };
    const args: RunArgs = {
      name: "run",
      root: ".",
      pretty: false,
      deck: side.path("deck.json"),
      processor: "s",
      runId: "r1",
      deadlineSeconds: 2400,
      maxCards: null,
      maxRetryBatches: 1
    };
    const logLines: string[] = [];
    const result = await runCommand(r.root, args, deps, (text) => {
      logLines.push(text);
    });
    expect(result.code).toBe(1);
    expect(logLines).toStrictEqual([
      "morph run: a.v1 rejected stage 0 finish stop chars 30\n",
      "morph run: a.r1.v1 rejected stage 0 finish stop chars 30\n"
    ]);
    const paths = r
      .git(["show", "--name-only", "--format=", "HEAD"])
      .split("\n");
    expect(paths).toStrictEqual([
      ".morph/runs/r1/answers/a.r1.v1.answer.txt",
      ".morph/runs/r1/answers/a.r1.v1.request.json",
      ".morph/runs/r1/answers/a.v1.answer.txt",
      ".morph/runs/r1/answers/a.v1.request.json",
      ".morph/runs/r1/deck.json",
      ".morph/runs/r1/report.json"
    ]);
    const retryRequest = JSON.parse(
      r.read(".morph/runs/r1/answers/a.r1.v1.request.json")
    ) as { messages: { content: string }[] };
    const lastMessage =
      retryRequest.messages[retryRequest.messages.length - 1].content;
    expect(lastMessage.includes("<acceptance_output>")).toBe(true);
    expect(r.git(["status", "--porcelain"])).toBe("");
  } finally {
    r.rm();
    side.rm();
  }
});

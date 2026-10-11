// tests/runloop/generation.p10c2.examples.test.ts — TASK_P10c2 §2.3, the judge's
// test of Process Generation examples 12 and 13: the onVariant records (one
// per request sent, verdict in the decided order) and lastStage.

import path from "node:path";
import { expect, test } from "vitest";
import { compileCard } from "../../src/compiler/compile.js";
import { lastStage, processGeneration } from "../../src/runloop/generation.js";
import type { Card } from "../../src/cards/types.js";
import type { Request } from "../../src/compiler/types.js";
import type { RunDeps, VariantRecord } from "../../src/runloop/types.js";
import { fakeFetch, tmpRoot } from "../helpers.js";

// the harness skeleton of TASK_P10c2 §2.1: a RunDeps literal over the stub
// processor, a recording commit hook, and a hook that pushes every record
function stubDeps(answersDir: string, records: VariantRecord[]): RunDeps {
  return {
    config: {
      id: "stub",
      type: "stub",
      model: "stub",
      apiKey: null,
      baseUrl: "https://openrouter.ai/api/v1",
      route: "sync",
      concurrency: 4,
      providerOrder: null,
      reasoning: null,
      timeoutMs: 600000,
      maxRetries: 0,
      answersDir
    },
    transport: { fetch: fakeFetch().fetch, sleep: async (): Promise<void> => {} },
    commit: (id, targets) => ({
      commit: "sha-" + id,
      diffstat: { files: targets.length, insertions: 1, deletions: 0 }
    }),
    now: (): number => 1000,
    env: { PATH: process.env.PATH ?? "" },
    onVariant: (r) => {
      records.push(r);
    }
  };
}

function cardOf(
  customId: string,
  targets: string[],
  contextSlice: string[],
  acceptance: string,
  variants: number
): Card {
  return {
    customId,
    intent: "generate",
    targets,
    contextSlice,
    instruction: "write " + targets.join(", "),
    acceptance,
    model: null,
    maxTokens: null,
    reasoning: null,
    variants,
    dependsOn: []
  };
}

// the expected requests are taken from compileCard BEFORE the generation runs
function requestsOf(c: Card, root: string): Request[] {
  const r = compileCard(c, root);
  if (!r.ok) {
    throw new Error("compile fault: " + r.faults.map((f) => f.message).join("\n"));
  }
  return r.requests;
}

test("Process Generation example 12", async () => {
  const t = tmpRoot("morph-p10c2-");
  try {
    t.write("out/a.ts", 'export const x = "OLD";\n');
    const a1 = '```ts\nexport const x = "ONE";\n```\n';
    const a2 = '```ts\nexport const x = "TWO";\n```\n';
    t.write("answers/a.v1.md", a1);
    t.write("answers/a.v2.md", a2);
    const records: VariantRecord[] = [];
    const deps = stubDeps(t.path("answers"), records);
    const cardA = cardOf(
      "a",
      ["out/a.ts"],
      [],
      "echo '== tsc'; echo '== probe'; grep -q TWO out/a.ts",
      2
    );
    const reqs = requestsOf(cardA, t.root);
    const outcome = await processGeneration([cardA], deps, t.root);
    const first = outcome.outcomes[0];
    expect(first.status).toBe("written");
    expect(first.winningVariant).toBe("a.v2");
    expect(records).toStrictEqual([
      {
        request: reqs[0],
        text: a1,
        finishReason: "stop",
        error: null,
        verdict: "rejected",
        stages: 2,
        lastStage: "probe"
      },
      {
        request: reqs[1],
        text: a2,
        finishReason: "stop",
        error: null,
        verdict: "accepted",
        stages: 2,
        lastStage: "probe"
      }
    ]);
    expect(lastStage("== tsc\n== probe\nred\n")).toBe("probe");
    expect(lastStage("")).toBe(null);
    expect(lastStage("a == b\n== eslint failed (see above)\n")).toBe(
      "eslint failed (see above)"
    );
    expect(lastStage("== tsc\n ==x\n==full\n")).toBe("tsc");
    expect(lastStage("x\n== full")).toBe("full");
  } finally {
    t.rm();
  }
});

test("Process Generation example 13", async () => {
  const t = tmpRoot("morph-p10c2-");
  try {
    // F2: shared.ts exists BEFORE the generation, or card b faults at compile
    // before the stale check could ever run
    t.write("shared.ts", 'export const x = "OLD";\n');
    const a1 = '```ts\nexport const x = "ONE";\n```\n';
    const a2 = '```ts\nexport const x = "TWO";\n```\n';
    const b1 = '```ts\nexport const b = 1;\n```\n';
    const c1 = '```ts\nexport const x = 2;\n';
    t.write("answers/a.v1.md", a1);
    t.write("answers/a.v2.md", a2);
    t.write("answers/b.v1.md", b1);
    t.write("answers/c.v1.md", c1);
    const answersDir = t.path("answers");
    const records: VariantRecord[] = [];
    const deps = stubDeps(answersDir, records);
    const cardA = cardOf("a", ["shared.ts"], [], "grep -q ONE shared.ts", 2);
    const cardB = cardOf("b", ["out/b.ts"], ["shared.ts"], "exit 0", 1);
    const cardC = cardOf("c", ["out/c.ts"], [], "exit 0", 1);
    const cardD = cardOf("d", ["out/d.ts"], [], "exit 0", 1);
    const cardE = cardOf("e", ["out/e.ts"], ["docs/missing.md"], "exit 0", 1);
    const aReqs = requestsOf(cardA, t.root);
    const bReqs = requestsOf(cardB, t.root);
    const cReqs = requestsOf(cardC, t.root);
    const dReqs = requestsOf(cardD, t.root);
    await processGeneration([cardA, cardB, cardC, cardD, cardE], deps, t.root);
    expect(records).toStrictEqual([
      {
        request: aReqs[0],
        text: a1,
        finishReason: "stop",
        error: null,
        verdict: "accepted",
        stages: 0,
        lastStage: null
      },
      {
        request: aReqs[1],
        text: a2,
        finishReason: "stop",
        error: null,
        verdict: "untried",
        stages: 0,
        lastStage: null
      },
      {
        request: bReqs[0],
        text: b1,
        finishReason: "stop",
        error: null,
        verdict: "stale",
        stages: 0,
        lastStage: null
      },
      {
        request: cReqs[0],
        text: c1,
        finishReason: "stop",
        error: null,
        verdict: "truncated",
        stages: 0,
        lastStage: null
      },
      {
        request: dReqs[0],
        text: null,
        finishReason: null,
        error: "stub has no answer: " + path.join(answersDir, "d.v1.md"),
        verdict: "corrupt",
        stages: 0,
        lastStage: null
      }
    ]);
    expect(records.some((r) => r.request.customId.startsWith("e."))).toBe(false);
  } finally {
    t.rm();
  }
});

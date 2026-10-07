// P11b probe for process-generation: the batch id on the Request Usage rows by docs/TASK_P11b_processor.md §2.2
// (issue #4 item 2) — batchId, last key, on a row whose customId is in the send result's batch.customIds, on every
// path once a batch id exists; no key on a pinned request's row or on the sync route. Record Process Generation
// example 14, then the §2.2 rows.
import { test, expect, expectTypeOf } from "vitest";
import { processGeneration } from "../../src/runloop/generation.js";
import type { Card } from "../../src/cards/types.js";
import type { ProcessorConfig, Transport } from "../../src/processor/types.js";
import type { RequestUsage, RunDeps } from "../../src/runloop/types.js";
import { fixture, fixtureJson, tmpRoot } from "../../tests/helpers.js";

const LIVE = "batch-1791388269-cp5qOr5IQ0xoz1ntuc8W";
const card = (customId: string, target: string, model: string | null = null): Card => ({
  customId, intent: "generate", targets: [target], contextSlice: [], instruction: "write " + target, acceptance: "true",
  model, maxTokens: null, reasoning: null, variants: 1, dependsOn: [] });
function transportOf(names: [number, string][]): Transport {
  let n = 0;
  return {
    fetch: async () => { const s = names[Math.min(n, names.length - 1)]; n += 1; if (s === undefined) throw new Error("no step");
      return { status: s[0], text: async () => fixture("processor/" + s[1]) }; },
    sleep: async () => {},
  };
}
const deps = (transport: Transport, over: Partial<ProcessorConfig> = {}): RunDeps => ({
  config: { ...(fixtureJson("processor/batchConfig.json") as ProcessorConfig), ...over }, transport,
  commit: (id) => ({ commit: "sha-" + id, diffstat: { files: 1, insertions: 1, deletions: 0 } }),
  now: () => 1000, env: { PATH: process.env.PATH ?? "" } });

test("Process Generation example 14: the batch-route rows carry the batch id, last; the pinned row none", async () => {
  const t = tmpRoot("morph-p11b-");
  try {
    const g = await processGeneration([card("clamp-value", "out/clamp.ts"), card("sign-of", "out/sign.ts"),
      card("pin", "out/pin.ts", "other/m")], deps(transportOf([[202, "batchSubmittedLive.json"], [200, "batchCompletedLive.json"]])), t.root);
    expect(g.outcomes.map((o) => `${o.customId} ${o.status}`).join(", "), "outcomes").toBe("clamp-value written, sign-of written, pin failed");
    expect(g.requests, "rows exactly tests/fixtures/runloop/batchRows.json").toStrictEqual(fixtureJson("runloop/batchRows.json"));
    expect(Object.keys(g.requests[0] as RequestUsage).pop(), "batchId last").toBe("batchId");
    expect("batchId" in (g.requests[2] as RequestUsage), "pin.v1").toBe(false);
  } finally {
    t.rm();
  }
});

test("§2.2 rows: a timed-out batch's rows name it too; the stub route has no batchId key", async () => {
  const t = tmpRoot("morph-p11b-");
  try {
    const g = await processGeneration([card("a", "out/a.ts")],
      deps(transportOf([[202, "batchSubmittedLive.json"], [200, "batchInProgress.json"]]), { timeoutMs: 15000 }), t.root);
    expect(`${g.outcomes[0]?.status} ${g.requests[0]?.batchId} ${g.requests[0]?.error}`, "timed out")
      .toBe(`failed ${LIVE} batch ${LIVE} still in_progress after 1 polls`);
    t.write("answers/b.v1.md", "```ts\nexport const b = 1;\n```\n");
    const s = await processGeneration([card("b", "out/b.ts")], deps(transportOf([]), { id: "stub", type: "stub", model: "stub",
      route: "sync", answersDir: t.path("answers") }), t.root);
    expect(s.requests, "stub rows").toStrictEqual([{ customId: "b.v1", model: "stub", provider: "stub", generationId: "stub-b.v1",
      inputTokens: 0, outputTokens: 0, cost: 0, finishReason: "stop", error: null }]);
  } finally {
    t.rm();
  }
  expectTypeOf<RequestUsage["batchId"]>().toEqualTypeOf<string | undefined>();
});

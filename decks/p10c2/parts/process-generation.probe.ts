// P10c2 probe for process-generation: the Variant Record of every variant sent, by docs/TASK_P10c2_runner.md §2.2
// (issue #3 C4) — deps.onVariant (optional) gets {request, text, finishReason, error, verdict, stages, lastStage}
// after the card is decided, in card order then variant order; lastStage exported. Record Process Generation
// examples 12-13, then the §2.2 rows (order against the commit hook, no hook = nothing changes, a timeout, types).
import { test, expect, expectTypeOf } from "vitest";
import { lastStage, processGeneration } from "../../src/runloop/generation.js";
import { compileCard } from "../../src/compiler/compile.js";
import type { Card } from "../../src/cards/types.js";
import type { Request } from "../../src/compiler/types.js";
import type { RunDeps, VariantRecord, VariantVerdict } from "../../src/runloop/types.js";
import { fakeFetch, tmpRoot, type TmpRoot } from "../../tests/helpers.js";

function harness(): { t: TmpRoot; deps: RunDeps; fired: string[]; records: VariantRecord[]; events: string[] } {
  const t = tmpRoot("morph-p10c2-");
  const fired: string[] = [];
  const records: VariantRecord[] = [];
  const events: string[] = [];
  const deps: RunDeps = {
    config: { id: "stub", type: "stub", model: "stub", apiKey: null, baseUrl: "https://openrouter.ai/api/v1", route: "sync",
      concurrency: 4, providerOrder: null, reasoning: null, timeoutMs: 600000, maxRetries: 0, answersDir: t.path("answers") },
    transport: { fetch: fakeFetch().fetch, sleep: async (): Promise<void> => {} },
    commit: (customId, targets) => {
      fired.push(customId);
      events.push("commit " + customId);
      return { commit: "sha-" + customId, diffstat: { files: targets.length, insertions: 1, deletions: 0 } };
    },
    now: (): number => 1000,
    env: { PATH: process.env.PATH ?? "" },
    onVariant: (record) => {
      records.push(record);
      events.push("record " + record.request.customId);
    },
  };
  return { t, deps, fired, records, events };
}
const fenced = (marker: string): string => '```ts\nexport const x = "' + marker + '";\n```\n';
const card = (customId: string, target: string, acceptance: string, variants = 1, contextSlice: string[] = []): Card => ({
  customId, intent: "generate", targets: [target], contextSlice, instruction: "write " + target, acceptance, model: null,
  maxTokens: null, reasoning: null, variants, dependsOn: [] });
const OLD = 'export const x = "OLD";\n';
const TRUNC = "```ts\nexport const x = 2;\n";
const brief = (r: VariantRecord): string =>
  `${r.request.customId} ${r.verdict} ${r.stages} ${String(r.lastStage)} ${String(r.finishReason)} ${r.text === null ? "null" : r.text.length}`;

test("Process Generation example 12: one record per variant, rejected then accepted, with the stage reached", async () => {
  const { t, deps, records } = harness();
  try {
    t.write("out/a.ts", OLD);
    t.write("answers/a.v1.md", fenced("ONE"));
    t.write("answers/a.v2.md", fenced("TWO"));
    const a = card("a", "out/a.ts", "echo '== tsc'; echo '== probe'; grep -q TWO out/a.ts", 2);
    const compiled = compileCard(a, t.root);
    const requests: Request[] = compiled.ok ? compiled.requests : [];
    const g = await processGeneration([a], deps, t.root);
    expect(`${g.outcomes[0]?.status} ${g.outcomes[0]?.winningVariant}`, "outcome").toBe("written a.v2");
    expect(records, "records").toStrictEqual([
      { request: requests[0], text: fenced("ONE"), finishReason: "stop", error: null, verdict: "rejected", stages: 2, lastStage: "probe" },
      { request: requests[1], text: fenced("TWO"), finishReason: "stop", error: null, verdict: "accepted", stages: 2, lastStage: "probe" },
    ]);
    expect(records[0]?.request.customId, "variant id").toBe("a.v1");
  } finally {
    t.rm();
  }
});

test("Process Generation example 12: lastStage is the text after '== ' of the last stage header", () => {
  expect([lastStage("== tsc\n== probe\nred\n"), lastStage(""), lastStage("a == b\n== eslint failed (see above)\n"),
    lastStage("== tsc\n ==x\n==full\n"), lastStage("x\n== full")], "lastStage").toStrictEqual(
    ["probe", null, "eslint failed (see above)", "tsc", "full"]);
  expectTypeOf(lastStage).toEqualTypeOf<(log: string) => string | null>();
});

test("Process Generation example 13: accepted, untried, stale, truncated, corrupt; none for a compile fault", async () => {
  const { t, deps, records } = harness();
  try {
    t.write("shared.ts", OLD);
    t.write("answers/a.v1.md", fenced("ONE"));
    t.write("answers/a.v2.md", fenced("TWO"));
    t.write("answers/b.v1.md", fenced("B"));
    t.write("answers/c.v1.md", TRUNC);
    const cards = [card("a", "shared.ts", "grep -q ONE shared.ts", 2), card("b", "out/b.ts", "true", 1, ["shared.ts"]),
      card("c", "out/c.ts", "true"), card("d", "out/d.ts", "true"), card("e", "out/e.ts", "true", 1, ["docs/missing.md"])];
    const g = await processGeneration(cards, deps, t.root);
    expect(g.outcomes.map((o) => o.status).join(" "), "statuses").toBe("written failed failed failed failed");
    expect(records.map(brief), "records").toStrictEqual([
      "a.v1 accepted 0 null stop " + fenced("ONE").length, "a.v2 untried 0 null stop " + fenced("TWO").length,
      "b.v1 stale 0 null stop " + fenced("B").length,
      "c.v1 truncated 0 null stop " + TRUNC.length, "d.v1 corrupt 0 null null null"]);
    expect(records[1]?.text, "the untried variant keeps its text").toBe(fenced("TWO"));
    expect(records[4]?.error, "the stub's error").toBe("stub has no answer: " + t.path("answers/d.v1.md"));
    expect(records.some((r) => r.request.customId.startsWith("e.")), "no record of a compile fault").toBe(false);
  } finally {
    t.rm();
  }
});

test("§2.2: an accepted card's commit hook fires before its records, a card's records before the next card", async () => {
  const { t, deps, events } = harness();
  try {
    t.write("answers/a.v1.md", fenced("A"));
    t.write("answers/b.v1.md", fenced("B"));
    await processGeneration([card("a", "out/a.ts", "true", 2), card("b", "out/b.ts", "exit 1")], deps, t.root);
    expect(events, "events").toStrictEqual(["commit a", "record a.v1", "record a.v2", "record b.v1"]);
  } finally {
    t.rm();
  }
});

test("§2.2: a rejected variant whose acceptance timed out counts its stages; no hook changes nothing", async () => {
  const { t, deps, records } = harness();
  try {
    deps.acceptanceTimeoutMs = 300;
    t.write("answers/a.v1.md", fenced("A"));
    await processGeneration([card("a", "out/a.ts", "echo '== tsc'; sleep 30")], deps, t.root);
    expect(records.map(brief), "records").toStrictEqual(["a.v1 rejected 1 tsc stop " + fenced("A").length]);
    const bare: RunDeps = { ...deps, onVariant: undefined };
    t.write("answers/b.v1.md", fenced("B"));
    const g = await processGeneration([card("b", "out/b.ts", "true")], bare, t.root);
    expect(`${g.outcomes[0]?.status} ${records.length}`, "no hook").toBe("written 1");
  } finally {
    t.rm();
  }
}, 20000);

test("§2.2: the types — VariantRecord, VariantVerdict, RunDeps.onVariant optional", () => {
  expectTypeOf<VariantVerdict>().toEqualTypeOf<"accepted" | "rejected" | "corrupt" | "truncated" | "untried" | "stale">();
  expectTypeOf<VariantRecord>().toEqualTypeOf<{
    request: Request; text: string | null; finishReason: string | null; error: string | null;
    verdict: VariantVerdict; stages: number; lastStage: string | null;
  }>();
  expectTypeOf<RunDeps["onVariant"]>().toEqualTypeOf<((record: VariantRecord) => void) | undefined>();
});

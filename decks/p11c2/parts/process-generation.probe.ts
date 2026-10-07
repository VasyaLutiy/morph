// P11c2 probe for process-generation by docs/TASK_P11c2_runner.md §2.2 (issue #5 finding 4) — a card whose acceptance is
// null or blank (whitespace only) is never compiled or sent: failed, reason and log "no acceptance", on the compile-fault
// path (no row, no usage, no Variant Record, no commit, its retry context, its place kept). Record Process Generation
// example 15, then the §2.2 rows.
import { test, expect } from "vitest";
import { processGeneration } from "../../src/runloop/generation.js";
import type { Card } from "../../src/cards/types.js";
import type { RunDeps, VariantRecord } from "../../src/runloop/types.js";
import { fakeFetch, tmpRoot } from "../../tests/helpers.js";
import type { TmpRoot } from "../../tests/helpers.js";

const card = (customId: string, target: string, acceptance: string | null, contextSlice: string[] = []): Card => ({
  customId, intent: "generate", targets: [target], contextSlice, instruction: "write " + target, acceptance,
  model: null, maxTokens: null, reasoning: null, variants: 1, dependsOn: [] });
const fenced = (mark: string): string => "```ts\nexport const x = \"" + mark + "\";\n```\n";
function deps(t: TmpRoot, fired: string[], records: VariantRecord[]): RunDeps {
  return {
    config: { id: "stub", type: "stub", model: "stub", apiKey: null, baseUrl: "https://openrouter.ai/api/v1", route: "sync",
      concurrency: 4, providerOrder: null, reasoning: null, timeoutMs: 600000, maxRetries: 0, answersDir: t.path("answers") },
    transport: { fetch: fakeFetch().fetch, sleep: async (): Promise<void> => {} },
    commit: (id) => { fired.push(id); return { commit: "sha-" + id, diffstat: { files: 1, insertions: 1, deletions: 0 } }; },
    now: () => 0, env: { PATH: process.env.PATH ?? "" }, onVariant: (r) => { records.push(r); } };
}
const none = (customId: string): unknown => ({ customId, status: "failed", reason: "no acceptance", attempts: 1, winningVariant: null,
  acceptanceLog: "no acceptance", earlierFailures: [], commit: null, diffstat: null });
const ctx = { acceptanceOutput: "no acceptance", previousDiff: null };

test("Process Generation example 15: no acceptance (null or blank) fails before any request", async () => {
  const t = tmpRoot("morph-p11c2-");
  try {
    for (const id of ["a", "b", "d"]) t.write(`answers/${id}.v1.md`, fenced("MARK_" + id.toUpperCase()));
    t.write("answers/c.v1.md", fenced("MARK_C"));
    const fired: string[] = [];
    const records: VariantRecord[] = [];
    const g = await processGeneration([card("a", "out/a.ts", null), card("b", "out/b.ts", " \n"),
      card("c", "out/c.ts", "grep -q MARK_C out/c.ts"), card("d", "out/d.ts", null, ["docs/missing.md"])], deps(t, fired, records), t.root);
    expect(g.outcomes.map((o) => `${o.customId} ${o.status} ${o.reason}`).join("; "), "statuses")
      .toBe("a failed no acceptance; b failed no acceptance; c written null; d failed no acceptance");
    expect(g.outcomes[0], "a's whole outcome").toStrictEqual(none("a"));
    expect(g.outcomes[3], "d: no acceptance beats the compile fault").toStrictEqual(none("d"));
    expect(g.requests.map((r) => r.customId).join(","), "rows").toBe("c.v1");
    expect(`${g.usage.length} ${fired.join(",")} ${records.map((r) => r.request.customId).join(",")}`, "usage, hook, records").toBe("1 c c.v1");
    expect(g.retryContexts, "retry contexts").toStrictEqual({ a: ctx, b: ctx, d: ctx });
    expect(`${t.exists("out/a.ts")} ${t.exists("out/b.ts")} ${t.exists("out/c.ts")}`, "files").toBe("false false true");
  } finally {
    t.rm();
  }
});

test("§2.2 rows: a tab-only acceptance alone sends nothing; a padded real command still runs", async () => {
  const t = tmpRoot("morph-p11c2-");
  try {
    t.write("answers/t.v1.md", fenced("T"));
    const fired: string[] = [];
    const records: VariantRecord[] = [];
    const g = await processGeneration([card("t", "out/t.ts", "\t")], deps(t, fired, records), t.root);
    expect(g.outcomes, "t").toStrictEqual([none("t")]);
    expect(`${g.usage.length} ${g.requests.length} ${fired.length} ${records.length}`, "nothing sent").toBe("0 0 0 0");
    t.write("answers/p.v1.md", fenced("P"));
    const h = await processGeneration([card("p", "out/p.ts", "  exit 1  ")], deps(t, [], []), t.root);
    expect(`${h.outcomes[0]?.status} ${h.outcomes[0]?.reason} ${h.requests.length}`, "a padded command is not blank").toBe("failed acceptance failed 1");
  } finally {
    t.rm();
  }
});

test("§2.2 rows: input order kept around a no-acceptance card; the others unchanged", async () => {
  const t = tmpRoot("morph-p11c2-");
  try {
    t.write("answers/y.v1.md", fenced("MARK_Y"));
    t.write("answers/z.v1.md", fenced("MARK_Z"));
    const fired: string[] = [];
    const g = await processGeneration([card("y", "out/y.ts", "grep -q MARK_Y out/y.ts"), card("x", "out/x.ts", ""),
      card("z", "out/z.ts", "grep -q MARK_Z out/z.ts")], deps(t, fired, []), t.root);
    expect(g.outcomes.map((o) => `${o.customId}:${o.status}`).join(","), "order").toBe("y:written,x:failed,z:written");
    expect(`${g.requests.map((r) => r.customId).join(",")} | ${fired.join(",")} | ${Object.keys(g.retryContexts).join(",")}`, "rows, hook, contexts")
      .toBe("y.v1,z.v1 | y,z | x");
  } finally {
    t.rm();
  }
});

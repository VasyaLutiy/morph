// P24b probe for accept-group by docs/TASK_P24b_group.md §2.2 (src/debt/acceptGroup.ts) — issue #16, the group accept.
// Record Accept Group examples 1–6.
import { test, expect } from "vitest";
import { acceptGroup } from "../../src/debt/acceptGroup.js";
import type { GroupOptions } from "../../src/debt/acceptGroup.js";
import { fixture, fixtureJson, tmpRepo } from "../../tests/helpers.js";
import type { TmpRepo } from "../../tests/helpers.js";

const DS = "deepseek/deepseek-v4.1-flash";
const env = (): Record<string, string> => ({ PATH: process.env.PATH ?? "" });
function base(archive: boolean): TmpRepo {
  const t = tmpRepo();
  t.write("d.json", fixture("debt/group.deck.json"));
  t.write("src/lib.ts", "export const lib = 1;\n");
  t.write("src/use.ts", "export const use = 1;\n");
  t.write("README.md", "r\n");
  t.git(["add", "."]);
  t.git(["commit", "-q", "-m", "base"]);
  if (archive) {
    const g = fixtureJson("debt/group.run.json") as { report: unknown; answers: Record<string, string> };
    t.write(".morph/runs/r1/report.json", JSON.stringify(g.report));
    for (const [k, v] of Object.entries(g.answers)) t.write(".morph/runs/r1/answers/" + k + ".answer.txt", v);
  }
  return t;
}
const opts = (o: Partial<GroupOptions>): GroupOptions =>
  ({ deck: "d.json", ids: ["lib"], model: null, fromRun: "r1", pick: [], commit: true, ...o });
const msg = (t: TmpRepo, ref: string): string => t.git(["log", "-1", "--format=%B", ref]);
const subject = (t: TmpRepo, ref: string): string => t.git(["log", "-1", "--format=%s", ref]);
const card = (c: string, variant: string | null, model: string, commit: string | null,
  diffstat: { files: number; insertions: number; deletions: number } | null) =>
  ({ card: c, variant, model, exit: 0, timedOut: false, green: true, log: "", commit, diffstat, reason: null });

test("Accept Group example 1: four archived answers on one tree, four commits in dependency order", async () => {
  const t = base(true);
  try {
    const r = await acceptGroup(t.root, opts({ ids: ["use-judge", "use", "two", "lib"] }), { env: env() });
    const shas = t.git(["rev-list", "--reverse", "HEAD~4..HEAD"]).split("\n");
    expect(r).toStrictEqual({ code: 0, document: { deck: "d.json", run: "r1", cards: [
      card("two", "two.v1", DS, shas[0], { files: 2, insertions: 3, deletions: 0 }),
      card("lib", "lib.v1", DS, shas[1], { files: 1, insertions: 1, deletions: 1 }),
      card("use", "use.v1", DS, shas[2], { files: 1, insertions: 2, deletions: 1 }),
      card("use-judge", "use-judge.v1", "z-ai/glm-5.3", shas[3], { files: 1, insertions: 2, deletions: 0 }),
    ], outside: [], green: true, committed: 4, restored: false, reason: null } });
    expect(msg(t, "HEAD~2")).toBe("morph lib: src/lib.ts\n\nMorph-Card: lib\nMorph-Model: deepseek/deepseek-v4.1-flash\n" +
      "Morph-Variant: lib.v1\nMorph-Run: r1\nMorph-Acceptance-Exit: 0");
    expect(msg(t, "HEAD")).toBe("morph use-judge: tests/use.test.ts\n\nMorph-Card: use-judge\nMorph-Model: z-ai/glm-5.3\n" +
      "Morph-Variant: use-judge.v1\nMorph-Run: r1\nMorph-Acceptance-Exit: 0");
    expect(subject(t, "HEAD~3")).toBe("morph two: src/x.ts, src/y.ts");
    expect([t.read("src/lib.ts"), t.read("src/y.ts")]).toStrictEqual(
      ["export const lib = (n: number): number => n;\n", "export const y = 2;\nexport const z = 3;\n"]);
    expect(t.git(["status", "--porcelain"])).toBe("?? .morph/");
  } finally {
    t.rm();
  }
}, 60000);

test("Accept Group example 2: a red member commits nothing and restores the tree; a dry group restores too", async () => {
  const t = base(true);
  try {
    const r = await acceptGroup(t.root, opts({ ids: ["lib", "use"], pick: ["use.v2"] }), { env: env() });
    expect(r).toStrictEqual({ code: 1, document: { deck: "d.json", run: "r1", cards: [
      card("lib", "lib.v1", DS, null, null),
      { card: "use", variant: "use.v2", model: DS, exit: 1, timedOut: false, green: false,
        log: "FAIL: src/use.ts needs the new lib\n", commit: null, diffstat: null, reason: "acceptance failed (exit 1)" },
    ], outside: [], green: false, committed: 0, restored: true, reason: "red: use" } });
    expect([subject(t, "HEAD"), t.read("src/lib.ts"), t.read("src/use.ts")]).toStrictEqual(
      ["base", "export const lib = 1;\n", "export const use = 1;\n"]);
    const dry = await acceptGroup(t.root, opts({ ids: ["lib", "use"], commit: false }), { env: env() });
    expect(dry).toStrictEqual({ code: 0, document: { deck: "d.json", run: "r1", cards: [
      card("lib", "lib.v1", DS, null, null), card("use", "use.v1", DS, null, null),
    ], outside: null, green: true, committed: 0, restored: true, reason: null } });
    expect([subject(t, "HEAD"), t.read("src/lib.ts")]).toStrictEqual(["base", "export const lib = 1;\n"]);
  } finally {
    t.rm();
  }
}, 60000);

test("Accept Group example 3: a pick takes that archived answer and its variant", async () => {
  const t = base(true);
  try {
    const r = await acceptGroup(t.root, opts({ ids: ["lib", "use"], pick: ["lib.r1.v1"] }), { env: env() });
    const doc = r.document as { committed: number; cards: unknown[] };
    expect([r.code, doc.committed, doc.cards[0]]).toStrictEqual(
      [0, 2, card("lib", "lib.r1.v1", DS, t.git(["rev-parse", "HEAD~1"]), { files: 1, insertions: 1, deletions: 1 })]);
    expect(msg(t, "HEAD~1")).toBe("morph lib: src/lib.ts\n\nMorph-Card: lib\nMorph-Model: deepseek/deepseek-v4.1-flash\n" +
      "Morph-Variant: lib.r1.v1\nMorph-Run: r1\nMorph-Acceptance-Exit: 0");
    expect(t.read("src/lib.ts")).toBe("export const lib = (n: number): number => n * 1;\n");
  } finally {
    t.rm();
  }
}, 60000);

test("Accept Group example 4: refusals before any write", async () => {
  const t = base(true);
  const e = (code: number, kind: string, message: string) => ({ code, document: { error: { code, kind, message } } });
  try {
    const got: unknown[] = [];
    for (const o of [{ ids: ["lib", "zz"] }, { ids: ["lib", "none"] }, { ids: ["lib", "dup"] }, { fromRun: "nope" },
      { pick: ["zz.v1"] }, { pick: ["lib"] }, { pick: ["lib.v1", "lib.r1.v1"] }, { pick: ["lib.v9"] }, { pick: ["lib.r2.v1"] },
      { ids: ["two"], pick: ["two.v2"] }]) {
      got.push(await acceptGroup(t.root, opts(o), { env: env() }));
      got.push([subject(t, "HEAD"), t.git(["status", "--porcelain"])]);
    }
    const ok = ["base", "?? .morph/"];
    expect(got).toStrictEqual([
      e(4, "UsageError", "no card 'zz' in d.json (have: use-judge, use, two, lib, none, dup)"), ok,
      e(2, "RefusalError", "card none has no acceptance"), ok,
      e(2, "RefusalError", "target src/lib.ts is in cards lib and dup"), ok,
      e(4, "UsageError", "no run nope under .morph/runs"), ok,
      e(4, "UsageError", "--pick zz.v1 names no card of --id"), ok,
      e(4, "UsageError", "--pick lib names no card of --id"), ok,
      e(4, "UsageError", "--pick names lib twice"), ok,
      e(2, "RefusalError", "no request lib.v9 in .morph/runs/r1/report.json"), ok,
      e(2, "RefusalError", "no answer .morph/runs/r1/answers/lib.r2.v1.answer.txt"), ok,
      e(2, "RefusalError", "answer two.v2 is truncated"), ok,
    ]);
  } finally {
    t.rm();
  }
}, 60000);

test("Accept Group example 5: a payer's tree: an outside change, then a red member; nothing restored", async () => {
  const t = base(false);
  const o = opts({ ids: ["use", "lib"], model: "claude-fable-5-1", fromRun: null });
  const F = "claude-fable-5-1";
  try {
    t.write("src/lib.ts", "export const lib = (n: number): number => n;\n");
    t.write("src/use.ts", "export const use = 1; // lib(2)\n");
    t.write("README.md", "r2\n");
    expect(await acceptGroup(t.root, o, { env: env() })).toStrictEqual({ code: 1, document: { deck: "d.json", run: null,
      cards: [card("lib", null, F, null, null), card("use", null, F, null, null)], outside: ["README.md"], green: true,
      committed: 0, restored: false, reason: "changed outside the targets: README.md" } });
    t.write("README.md", "r\n");
    t.write("src/use.ts", "export const use = 1;\n");
    expect(await acceptGroup(t.root, o, { env: env() })).toStrictEqual({ code: 1, document: { deck: "d.json", run: null,
      cards: [card("lib", null, F, null, null), { card: "use", variant: null, model: F, exit: 1, timedOut: false, green: false,
        log: "FAIL: src/use.ts needs the new lib\n", commit: null, diffstat: null, reason: "acceptance failed (exit 1)" }],
      outside: [], green: false, committed: 0, restored: false, reason: "red: use" } });
    expect([subject(t, "HEAD"), t.read("src/lib.ts")]).toStrictEqual(["base", "export const lib = (n: number): number => n;\n"]);
  } finally {
    t.rm();
  }
}, 60000);

test("Accept Group example 6: a payer's group is committed with the debt trailers", async () => {
  const t = base(false);
  try {
    t.write("src/lib.ts", "export const lib = (n: number): number => n;\n");
    t.write("src/use.ts", "export const use = 1; // lib(2)\n");
    const r = await acceptGroup(t.root, opts({ ids: ["use", "lib"], model: "claude-fable-5-1", fromRun: null }), { env: env() });
    const doc = r.document as { committed: number; restored: boolean; run: string | null };
    expect([r.code, doc.committed, doc.restored, doc.run]).toStrictEqual([0, 2, false, null]);
    expect(msg(t, "HEAD")).toBe("morph use: src/use.ts\n\nMorph-Card: use\nMorph-Model: claude-fable-5-1\n" +
      "Morph-Acceptance-Exit: 0\nMorph-Debt: true");
    expect(subject(t, "HEAD~1")).toBe("morph lib: src/lib.ts");
  } finally {
    t.rm();
  }
}, 60000);

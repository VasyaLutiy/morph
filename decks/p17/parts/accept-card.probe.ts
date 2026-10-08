// P17 probe for accept-card by docs/TASK_P17_debt.md §2.2 (src/debt/acceptCard.ts) — the card's acceptance on the tree
// as it is (never rolled back), the outside list taken before it (only with commit, .morph/ exempt), the debt commit of
// only the targets with the four trailers, the reasons and the exit code. Record Accept Card examples 1-5, then one row.
import { test, expect } from "vitest";
import { acceptCard, changedOutside } from "../../src/debt/acceptCard.js";
import { fixture, tmpRepo, tmpRoot } from "../../tests/helpers.js";
import type { TmpRepo } from "../../tests/helpers.js";

const PATH = process.env.PATH ?? "";
const env = { PATH };
const D = fixture("debt/accept.deck.json");
const args = (over: object): { deck: string; id: string; model: string; commit: boolean } =>
  ({ deck: "d.json", id: "fix-a", model: "claude-fable-5-1", commit: true, ...over });
const doc = (over: object): object => ({ deck: "d.json", card: "fix-a", model: "claude-fable-5-1", exit: 0, timedOut: false,
  green: true, log: "", outside: [], commit: null, diffstat: null, reason: null, ...over });

function based(): { t: TmpRepo; base: string } {
  const t = tmpRepo();
  t.write("d.json", D);
  t.write("src/a.ts", "broken\n");
  t.write("README.md", "r\n");
  t.git(["add", "."]);
  t.git(["commit", "-q", "-m", "base"]);
  return { t, base: t.git(["rev-parse", "HEAD"]) };
}

test("Accept Card example 1: green, one commit of the target with the four trailers; then nothing to commit", async () => {
  const { t, base } = based();
  try {
    t.write("src/a.ts", "fixed\n");
    t.write(".morph/runs/x/report.json", "{}\n");
    const r = await acceptCard(t.root, args({}), { env });
    const head = t.git(["rev-parse", "HEAD"]);
    expect(head).not.toBe(base);
    expect(r).toStrictEqual({ code: 0, document: doc({ commit: head, diffstat: { files: 1, insertions: 1, deletions: 1 } }) });
    expect(t.git(["log", "-1", "--format=%B"])).toBe(
      "morph fix-a: src/a.ts\n\nMorph-Card: fix-a\nMorph-Model: claude-fable-5-1\nMorph-Acceptance-Exit: 0\nMorph-Debt: true");
    expect(t.git(["show", "--name-only", "--format=", "HEAD"])).toBe("src/a.ts");
    expect(await acceptCard(t.root, args({}), { env })).toStrictEqual(
      { code: 1, document: doc({ reason: "nothing to commit: the targets equal HEAD" }) });
    expect(t.git(["rev-parse", "HEAD"])).toBe(head);
  } finally {
    t.rm();
  }
});

test("Accept Card example 2: red, no commit, nothing rolled back", async () => {
  const { t, base } = based();
  try {
    t.write("src/a.ts", "still broken\n");
    expect(await acceptCard(t.root, args({}), { env })).toStrictEqual({ code: 1, document: doc({ exit: 1, green: false,
      log: "FAIL: src/a.ts not fixed\n", reason: "acceptance failed (exit 1)" }) });
    expect(t.git(["rev-parse", "HEAD"])).toBe(base);
    expect(t.read("src/a.ts")).toBe("still broken\n");
  } finally {
    t.rm();
  }
});

test("Accept Card example 3: a change outside the targets refuses the commit", async () => {
  const { t, base } = based();
  try {
    t.write("src/a.ts", "fixed again\n");
    t.write("README.md", "r2\n");
    t.write("notes/n.txt", "n\n");
    expect(await acceptCard(t.root, args({}), { env })).toStrictEqual({ code: 1, document: doc({
      outside: ["README.md", "notes/n.txt"], reason: "changed outside the targets: README.md, notes/n.txt" }) });
    t.write("src/a.ts", "broken!\n");
    expect(await acceptCard(t.root, args({}), { env })).toStrictEqual({ code: 1, document: doc({ exit: 1, green: false,
      log: "FAIL: src/a.ts not fixed\n", outside: ["README.md", "notes/n.txt"],
      reason: "acceptance failed (exit 1); changed outside the targets: README.md, notes/n.txt" }) });
    expect(t.git(["rev-parse", "HEAD"])).toBe(base);
  } finally {
    t.rm();
  }
});

test("Accept Card example 4: without commit no git runs; the env's keys stripped; the timeout", async () => {
  const r = tmpRoot();
  try {
    r.write("d.json", D);
    r.write("src/b.ts", "b\n");
    r.write("out/g.ts", "g\n");
    const two = { card: "fix-two", outside: null };
    expect(await acceptCard(r.root, args({ id: "fix-two", commit: false }), { env: { PATH, MARK: "k7", GH_TOKEN: "t" } }))
      .toStrictEqual({ code: 0, document: doc(two) });
    expect(await acceptCard(r.root, args({ id: "fix-two", commit: false }), { env: { PATH, MARK: "k8" } }))
      .toStrictEqual({ code: 1, document: doc({ ...two, exit: 1, green: false, reason: "acceptance failed (exit 1)" }) });
    expect(await acceptCard(r.root, args({ id: "slow", commit: false }), { env, timeoutMs: 300 })).toStrictEqual({ code: 1,
      document: doc({ card: "slow", outside: null, exit: null, timedOut: true, green: false,
        log: "started\nacceptance timed out after 300 ms\n", reason: "acceptance failed (exit null)" }) });
  } finally {
    r.rm();
  }
});

test("Accept Card example 5: an ignored target committed; the refusals; git outside a repository", async () => {
  const g = tmpRepo();
  const r = tmpRoot();
  try {
    g.write("d.json", D);
    g.write(".gitignore", "out/\n");
    g.git(["add", "."]);
    g.git(["commit", "-q", "-m", "base"]);
    g.write("src/b.ts", "b\n");
    g.write("out/g.ts", "g\n");
    const res = await acceptCard(g.root, args({ id: "fix-two", model: "acme/m:free" }), { env: { PATH, MARK: "k7" } });
    expect(res).toStrictEqual({ code: 0, document: doc({ card: "fix-two", model: "acme/m:free", commit: g.git(["rev-parse", "HEAD"]),
      diffstat: { files: 2, insertions: 2, deletions: 0 } }) });
    expect(g.git(["log", "-1", "--format=%B"])).toBe(
      "morph fix-two: src/b.ts, out/g.ts\n\nMorph-Card: fix-two\nMorph-Model: acme/m:free\nMorph-Acceptance-Exit: 0\nMorph-Debt: true");
    expect(g.git(["show", "--name-only", "--format=", "HEAD"])).toBe("out/g.ts\nsrc/b.ts");
    const err = (code: number, kind: string, message: string): object => ({ code, document: { error: { code, kind, message } } });
    expect([
      await acceptCard(g.root, args({ id: "none" }), { env }),
      await acceptCard(g.root, args({ id: "blank" }), { env }),
      await acceptCard(g.root, args({ id: "zz" }), { env }),
      await acceptCard(g.root, args({ deck: "x.json" }), { env }),
    ]).toStrictEqual([
      err(2, "RefusalError", "card none has no acceptance"),
      err(2, "RefusalError", "card blank has no acceptance"),
      err(4, "UsageError", "no card 'zz' in d.json (have: fix-a, fix-two, slow, none, blank)"),
      err(4, "UsageError", "deck file not found: x.json"),
    ]);
    r.write("d.json", D);
    r.write("src/a.ts", "fixed\n");
    await expect(acceptCard(r.root, args({}), { env })).rejects.toThrow(/^git status failed \(exit 128\): /);
  } finally {
    g.rm();
    r.rm();
  }
});

test("rows: the outside list is the tree before the acceptance, not what the acceptance leaves", async () => {
  const t = tmpRepo();
  try {
    t.write("d.json", JSON.stringify([{ customId: "mk", intent: "generate", targets: ["src/m.ts"], instruction: "m",
      acceptance: "echo made > made.txt" }]));
    t.git(["add", "."]);
    t.git(["commit", "-q", "-m", "base"]);
    t.write("src/m.ts", "m\n");
    const r = await acceptCard(t.root, { deck: "d.json", id: "mk", model: "q", commit: true }, { env });
    expect([r.code, (r.document as { outside: unknown }).outside, t.git(["show", "--name-only", "--format=", "HEAD"])])
      .toStrictEqual([0, [], "src/m.ts"]);
  } finally {
    t.rm();
  }
});

test("rows: changedOutside — renames, .morph/, targets, distinct and sorted", () => {
  const t = tmpRepo();
  try {
    t.write("z.txt", "z\n");
    t.write("m/old.ts", "o\n");
    t.write("keep.ts", "k\n");
    t.git(["add", "."]);
    t.git(["commit", "-q", "-m", "base"]);
    t.git(["mv", "m/old.ts", "m/new.ts"]);
    t.write("z.txt", "z2\n");
    t.write("keep.ts", "k2\n");
    t.write(".morph/a/b.json", "{}\n");
    t.write(".morphx/c.txt", "c\n");
    t.write("A.txt", "a\n");
    expect(changedOutside(t.root, ["keep.ts"], env)).toStrictEqual([".morphx/c.txt", "A.txt", "m/new.ts", "z.txt"]);
    expect(changedOutside(t.root, ["keep.ts", "z.txt", "m/new.ts"], env)).toStrictEqual([".morphx/c.txt", "A.txt"]);
  } finally {
    t.rm();
  }
});

// P13b probe for parse-command by docs/TASK_P13b_scout.md §2.2 (Parse Command, Main) — the word scout and its flags
// (--processor, --issue, --seed-file, --deadline), plan --from-scout as its own command, review the last not-yet word,
// the no-command message with seven commands; main routes scout to Scout Command with its deps and plan --from-scout to
// Plan From Scout. Record Parse Command examples 4 and 8 (changed), 17 and 18, Main examples 10 and 11, then the §2.2 rows.
import fs from "node:fs";
import { test, expect } from "vitest";
import { parseCommand } from "../../src/cli/parse.js";
import { main } from "../../src/cli/main.js";
import type { CliDeps, CliIo, Command } from "../../src/cli/types.js";
import { fixtureJson, tmpRepo, tmpRoot } from "../../tests/helpers.js";

const usage = (message: string) => ({ ok: false, error: { error: { code: 4, kind: "UsageError", message } } });
function io(): CliIo & { out: string[]; err: string[] } {
  const out: string[] = [];
  const err: string[] = [];
  return { out, err, stdout: (text) => { out.push(text); }, stderr: (text) => { err.push(text); } };
}
const argv = fixtureJson("cli/parseArgv.json") as Record<string, string[][]>;
const want = fixtureJson("cli/parse.json") as Record<string, unknown[]>;
function byFixture(key: string, n: number): void {
  const got = argv[key].map((a) => parseCommand(a));
  expect(got.length, `${key}: ${n} argv`).toBe(n);
  for (let i = 0; i < n; i++) expect(got[i], `parse.json ${key}[${i}] for ${JSON.stringify(argv[key][i])}`).toStrictEqual(want[key][i]);
}

test("Parse Command examples 4 and 8 (changed): review is the not-yet word; no command lists seven", () => {
  byFixture("4", 2);
  byFixture("8", 2);
  expect(parseCommand([]), "no command").toStrictEqual(usage("no command (commands: deck check, plan, run, submit, collect, primer, scout)"));
  expect(parseCommand(["review"]), "review").toStrictEqual({ ok: false, error: { error: { code: 4, kind: "NotYetError", message: "command review is not available yet" } } });
});

test("Parse Command example 17: the word scout, its flags and defaults", () => {
  byFixture("17", 7);
});

test("Parse Command example 18: plan --from-scout", () => {
  byFixture("18", 6);
});

test("Main examples 10 and 11: scout then plan --from-scout routed; their refusals", async () => {
  const t = tmpRepo();
  const s = tmpRoot("morph-side-");
  const e = tmpRoot("morph-empty-");
  try {
    t.write("src/a.ts", "export const a = 1;\n");
    t.git(["add", "."]);
    t.git(["commit", "-q", "-m", "a"]);
    s.write("task.txt", "Double a.\n");
    s.write("ans/scout.t1.md", 'ANSWER {"targets": ["src/a.ts"]}');
    const deps: CliDeps = { env: { PATH: process.env.PATH ?? "", MORPH_PROCESSOR_s_TYPE: "stub", MORPH_PROCESSOR_s_ANSWERS_DIR: s.path("ans") },
      now: () => 1791500000000, cwd: s.root, transport: null };
    const o = io();
    expect(await main(["scout", "--processor", "s", "--issue", "task.txt", "--root", t.root], deps, o), "scout exit").toBe(0);
    expect(o.out.length, "one chunk").toBe(1);
    const doc = JSON.parse(o.out[0]) as { scoutId: string; scout: string; status: string; answer: unknown };
    expect([doc.status, doc.answer, doc.scout], "scout doc").toStrictEqual(["ok", { targets: ["src/a.ts"], context_slice: [], reasoning: "" },
      `.morph/scout/${doc.scoutId}/scout.json`]);
    expect(doc.scoutId.startsWith("20261008-225320-"), "id").toBe(true);
    expect(o.err, "stderr").toStrictEqual(["morph scout: exit 0\n"]);
    const q = io();
    expect(await main(["plan", "--from-scout", "latest", "--root", t.root, "--out", "decks/s.json"], deps, q), "plan exit").toBe(0);
    const plan = JSON.parse(q.out[0]) as { scoutId: string; cards: { customId: string; targets: string[]; intent: string }[]; out: string };
    expect([plan.scoutId, plan.cards[0].customId, plan.cards[0].targets, plan.cards[0].intent, plan.out], "plan doc").toStrictEqual(
      [doc.scoutId, "scout-" + doc.scoutId, ["src/a.ts"], "patch", "decks/s.json"]);
    expect(JSON.parse(t.read("decks/s.json")), "deck file").toStrictEqual(plan.cards);
    expect(q.err, "stderr 2").toStrictEqual(["morph plan --from-scout: exit 0\n"]);
    const r = io();
    expect(await main(["scout", "--processor", "nope", "--issue", "task.txt", "--root", t.root], deps, r), "nope").toBe(4);
    expect(JSON.parse(r.out[0]), "nope doc").toStrictEqual({ error: { code: 4, kind: "UsageError", message: "processor nope is not configured" } });
    expect(r.err, "stderr 3").toStrictEqual(["morph scout: exit 4\n"]);
    const u = io();
    expect(await main(["plan", "--from-scout", "latest", "--root", e.root], deps, u), "none").toBe(4);
    expect(JSON.parse(u.out[0]), "none doc").toStrictEqual({ error: { code: 4, kind: "UsageError", message: "no scout session under .morph/scout" } });
    expect(u.err, "stderr 4").toStrictEqual(["morph plan --from-scout: exit 4\n"]);
    const v = io();
    expect(await main(["scout", "--processor", "s", "--issue", "task.txt", "--root", e.root], deps, v), "not a repo").toBe(3);
    const ev = JSON.parse(v.out[0]) as { error: { code: number; kind: string; message: string } };
    expect(`${ev.error.kind}|${ev.error.message.startsWith("git ls-files failed (exit 128): ")}`, "runtime").toBe("RuntimeError|true");
  } finally {
    t.rm();
    s.rm();
    e.rm();
  }
});

test("§2.2 rows: the Command members typed; the old commands unchanged; --pretty on scout's document", async () => {
  const scout: Command = { name: "scout", root: ".", pretty: false, processor: "p", issue: "i", seedFile: null, deadlineSeconds: 1800 };
  const from: Command = { name: "plan --from-scout", root: ".", pretty: false, fromScout: "latest", out: null };
  expect(parseCommand(["scout", "--processor", "p", "--issue", "i"])).toStrictEqual({ ok: true, command: scout });
  expect(parseCommand(["plan", "--from-scout", "latest"])).toStrictEqual({ ok: true, command: from });
  expect(parseCommand(["plan", "--spec", "c", "--out", "o"])).toStrictEqual({ ok: true, command: { name: "plan", root: ".", pretty: false, spec: "c",
    components: [], map: null, judge: false, out: "o" } });
  expect(parseCommand(["primer", "--issue", "x"])).toStrictEqual(usage("flag --issue does not apply to primer"));
  expect(parseCommand(["scout", "--processor", "p", "--issue", "i", "--deadline", "7", "--seed-file", "s"])).toStrictEqual(
    { ok: true, command: { ...scout, seedFile: "s", deadlineSeconds: 7 } });
  expect(parseCommand(["plan", "--from-scout", "x", "--out", "a", "--root", "/q"])).toStrictEqual({ ok: true, command: { ...from, root: "/q", fromScout: "x", out: "a" } });
  const p = tmpRoot("morph-pp-");
  try {
    const o = io();
    const deps: CliDeps = { env: {}, now: () => 0, cwd: p.root, transport: null };
    expect(await main(["plan", "--from-scout", "s1", "--pretty"], deps, o)).toBe(4);
    expect(o.out[0]).toBe('{\n  "error": {\n    "code": 4,\n    "kind": "UsageError",\n    "message": "scout session not found: s1"\n  }\n}\n');
    expect(fs.existsSync(p.path(".morph"))).toBe(false);
  } finally {
    p.rm();
  }
});

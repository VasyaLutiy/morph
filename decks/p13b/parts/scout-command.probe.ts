// P13b probe for scout-command by docs/TASK_P13b_scout.md §2.2 (Scout Command) — `morph scout`: the processor from the
// registry, the task from --issue, the tree from git ls-files, the seed from git's ownership or --seed-file, the node:fs
// ScoutFs adapter, Run Scout, then .morph/scout/<id>/scout.json (provenance and spend) and transcript.json; exit 0 on an
// answer, 1 without one, 4 before any spend. Record Scout Command examples 1-5, then the §2.2 rows. The model turns come
// from the stub processor (an answers dir in a side root).
import fs from "node:fs";
import { test, expect } from "vitest";
import { FILE_SEED_HEADER, NODE_SCOUT_FS, SCOUT_DIR, readSeedFile, renderFileSeed, scoutCommand, scoutId, sha256 } from "../../src/scout/scoutCommand.js";
import type { ScoutCommandDeps, ScoutOptions, ScoutRecord } from "../../src/scout/scoutCommand.js";
import { PROTOCOL } from "../../src/scout/runScout.js";
import { DEFAULT_TOOL_CAPS } from "../../src/scout/runTool.js";
import { SEED_HEADER } from "../../src/scout/seedFromOwnership.js";
import { fakeFetch, tmpRepo, tmpRoot } from "../../tests/helpers.js";
import type { TmpRepo, TmpRoot } from "../../tests/helpers.js";

const NOW = 1791500000000;
const Q = "Make b twice a.\n";
const QSHA = "74e423b13c2bf8652f79c8574d8df4851d73528b737afb6e481a609303ecb92f";
const ID = "20261008-225320-74e423b1";
const READ_B = 'READ src/b.ts lines 1-2 of 2\n1: import { a } from "./a.js";\n2: export const b = a + 1;';
const ANSWER = 'ANSWER {"targets": ["src/b.ts"], "context_slice": ["src/a.ts"], "reasoning": "b reads a"}';
const SEED_NOTE = "- src/b.ts: written by b (m/b, run —)\n";

function repo(): TmpRepo {
  const t = tmpRepo();
  t.write("README.md", "tiny\n");
  t.write("src/a.ts", "export const a = 1;\n");
  t.git(["add", "."]);
  t.git(["commit", "-q", "-m", "files"]);
  t.write("src/b.ts", 'import { a } from "./a.js";\nexport const b = a + 1;\n');
  t.git(["add", "."]);
  t.git(["commit", "-q", "-m", "morph b: src/b.ts\n\nMorph-Card: b\nMorph-Model: m/b"]);
  return t;
}
function side(answers: string[]): TmpRoot {
  const s = tmpRoot("morph-side-");
  s.write("task.txt", Q);
  fs.mkdirSync(s.path("ans"));
  answers.forEach((a, i) => s.write(`ans/scout.t${i + 1}.md`, a));
  return s;
}
function deps(s: TmpRoot): ScoutCommandDeps {
  return { env: { PATH: process.env.PATH ?? "", MORPH_PROCESSOR_s_TYPE: "stub", MORPH_PROCESSOR_s_ANSWERS_DIR: s.path("ans") }, now: () => NOW, cwd: s.root, transport: null };
}
const ARGS: ScoutOptions = { processor: "s", issue: "task.txt", seedFile: null, deadlineSeconds: 60 };
const usage = (message: string) => ({ code: 4, document: { error: { code: 4, kind: "UsageError", message } } });

test("Scout Command example 1: a session seeded from git's ownership, scout.json and transcript.json written", async () => {
  const t = repo();
  const s = side(["READ src/b.ts", ANSWER]);
  try {
    const got = await scoutCommand(t.root, ARGS, deps(s));
    const answer = { targets: ["src/b.ts"], context_slice: ["src/a.ts"], reasoning: "b reads a" };
    const spent = { calls: 1, reads: 1, chars: READ_B.length, rounds: 2 };
    const use = { requests: 2, inputTokens: 0, outputTokens: 0, cost: 0 };
    expect(got).toStrictEqual({ code: 0, document: { scoutId: ID, scout: `.morph/scout/${ID}/scout.json`, status: "ok", answer,
      stopReason: "the model answered on its own", spent, elapsedMs: 0, usage: use } });
    const seedText = SEED_HEADER + "\n" + SEED_NOTE;
    const want: ScoutRecord = {
      schema: 1, scoutId: ID, createdAt: "2026-10-08T22:53:20.000Z", root: t.root, ref: t.git(["rev-parse", "HEAD"]), question: Q,
      questionSha256: QSHA, protocolSha256: sha256(PROTOCOL), processor: "s", model: "stub",
      seed: { source: "primer", path: null, files: ["src/b.ts"], chars: seedText.length },
      budgets: { calls: 30, reads: 12, chars: 120000, rounds: 40, deadlineMs: 60000 }, caps: DEFAULT_TOOL_CAPS,
      status: "ok", answer, stopReason: "the model answered on its own", spent, elapsedMs: 0, usage: use,
      journal: [
        { round: 1, turn: "action", action: { kind: "read", path: "src/b.ts", from: null, to: null }, chars: READ_B.length, error: null, inputTokens: 0, outputTokens: 0, cost: 0 },
        { round: 2, turn: "answer", action: null, chars: 0, error: null, inputTokens: 0, outputTokens: 0, cost: 0 },
      ],
    };
    const text = t.read(`.morph/scout/${ID}/scout.json`);
    expect(JSON.parse(text)).toStrictEqual(want);
    expect(text).toBe(JSON.stringify(want, null, 2) + "\n");
    const transcript = JSON.parse(t.read(`.morph/scout/${ID}/transcript.json`)) as { role: string; content: string }[];
    expect(transcript.map((m) => m.role).join(",")).toBe("system,user,assistant,user,assistant");
    expect(transcript[1].content).toBe(seedText + "\nLIST .: 2 entries\nREADME.md\nsrc/ (2 files)\n\nTask:\n" + Q);
    expect(t.git(["status", "--porcelain"])).toBe("?? .morph/");
  } finally {
    t.rm();
    s.rm();
  }
});

test("Scout Command example 2: --seed-file replaces the ownership seed; its five refusals", async () => {
  const t = repo();
  const s = side(["READ src/b.ts", ANSWER]);
  try {
    s.write("seed.json", JSON.stringify({ files: ["src/a.ts"], notes: ["a is the base"] }));
    const got = await scoutCommand(t.root, { ...ARGS, seedFile: "seed.json" }, deps(s));
    expect(got.code).toBe(0);
    const rec = JSON.parse(t.read(`.morph/scout/${ID}/scout.json`)) as ScoutRecord;
    const seedText = FILE_SEED_HEADER + "\n- src/a.ts\nNote: a is the base\n";
    expect(rec.seed).toStrictEqual({ source: "file", path: "seed.json", files: ["src/a.ts"], chars: seedText.length });
    const transcript = JSON.parse(t.read(`.morph/scout/${ID}/transcript.json`)) as { content: string }[];
    expect(transcript[1].content.startsWith(seedText + "\nLIST .: ")).toBe(true);
    s.write("bad.json", "{");
    s.write("z.json", '{"files": ["src/z.ts"]}');
    s.write("e.json", '{"files": []}');
    s.write("n.json", '{"files": ["src/a.ts"], "notes": [1]}');
    const run = (seedFile: string) => scoutCommand(t.root, { ...ARGS, seedFile }, deps(s));
    expect(await run("nope.json")).toStrictEqual(usage("seed file not found: nope.json"));
    expect(await run("bad.json")).toStrictEqual(usage("seed file bad.json: the JSON does not parse"));
    expect(await run("z.json")).toStrictEqual(usage("seed file z.json: not in the tree: src/z.ts"));
    expect(await run("e.json")).toStrictEqual(usage("seed file e.json: files must be a non-empty list of paths"));
    expect(await run("n.json")).toStrictEqual(usage("seed file n.json: notes must be a list of strings"));
  } finally {
    t.rm();
    s.rm();
  }
});

test("Scout Command example 3: refusals before any spend write nothing; a root outside git throws", async () => {
  const t = repo();
  const s = side([ANSWER]);
  const n = tmpRoot("morph-nogit-");
  try {
    s.write("blank.txt", "  \n");
    const d = deps(s);
    expect(await scoutCommand(t.root, { ...ARGS, processor: "nope" }, d)).toStrictEqual(usage("processor nope is not configured"));
    expect(await scoutCommand(t.root, { ...ARGS, processor: "bad" }, { ...d, env: { ...d.env, MORPH_PROCESSOR_bad_TYPE: "x" } })).toStrictEqual(
      usage("processor bad is not configured: MORPH_PROCESSOR_bad_TYPE must be one of openrouter, stub (got 'x')"));
    expect(await scoutCommand(t.root, { ...ARGS, issue: "none.txt" }, d)).toStrictEqual(usage("issue file not found: none.txt"));
    expect(await scoutCommand(t.root, { ...ARGS, issue: "blank.txt" }, d)).toStrictEqual(usage("issue file is empty: blank.txt"));
    expect(t.exists(".morph")).toBe(false);
    await expect(scoutCommand(n.root, ARGS, d)).rejects.toThrow(/^git ls-files failed \(exit 128\): /);
    expect(n.exists(".morph")).toBe(false);
  } finally {
    t.rm();
    s.rm();
    n.rm();
  }
});

test("Scout Command example 4: no answer — exit 1, scout.json still written with status no_answer", async () => {
  const t = repo();
  const s = side([]);
  try {
    const got = await scoutCommand(t.root, { ...ARGS, deadlineSeconds: 5 }, deps(s));
    const reason = `no answer: the model call failed in round 1: stub has no answer: ${s.path("ans")}/scout.t1.md`;
    expect(got.code).toBe(1);
    const doc = got.document as { status: string; answer: unknown; stopReason: string; usage: { requests: number } };
    expect([doc.status, doc.answer, doc.stopReason, doc.usage.requests]).toStrictEqual(["no_answer", null, reason, 1]);
    const rec = JSON.parse(t.read(`.morph/scout/${ID}/scout.json`)) as ScoutRecord;
    expect([rec.status, rec.answer, rec.stopReason, rec.budgets.deadlineMs, rec.journal.length]).toStrictEqual(["no_answer", null, reason, 5000, 1]);
  } finally {
    t.rm();
    s.rm();
  }
});

test("Scout Command example 5: the id, the sha, the file seed text, the seed reader, the node:fs adapter", () => {
  expect(scoutId(NOW, QSHA)).toBe(ID);
  expect(scoutId(0, "0123456789abcdef")).toBe("19700101-000000-01234567");
  expect(sha256("")).toBe("e3b0c44298fc1c149afbf4c8996fb92427ae41e4649b934ca495991b7852b855");
  expect(sha256(Q)).toBe(QSHA);
  expect(renderFileSeed(["x/a.py", "b.ts"], ["one", "two"])).toBe(FILE_SEED_HEADER + "\n- x/a.py\n- b.ts\nNote: one\nNote: two\n");
  expect(readSeedFile('{"files": ["b.ts"]}', ["a.ts", "b.ts"])).toStrictEqual({ ok: true, files: ["b.ts"], notes: [] });
  expect(readSeedFile('["b.ts"]', ["b.ts"])).toStrictEqual({ ok: false, error: "files must be a non-empty list of paths" });
  expect(readSeedFile('{"files": ["b.ts", ""]}', ["b.ts"])).toStrictEqual({ ok: false, error: "files must be a non-empty list of paths" });
  expect([SCOUT_DIR, FILE_SEED_HEADER]).toStrictEqual([".morph/scout", "Seed: files the operator named (--seed-file):"]);
  const p = tmpRoot("morph-fs-");
  try {
    p.write("x.txt", "hello\n");
    expect(NODE_SCOUT_FS.readFile(p.path("x.txt"))).toBe("hello\n");
    expect(NODE_SCOUT_FS.realpath(p.path("x.txt"))).toBe(p.path("x.txt"));
    expect(() => NODE_SCOUT_FS.realpath(p.path("gone"))).toThrow();
  } finally {
    p.rm();
  }
});

test("§2.2 rows: the listing holds untracked files and no ignored ones; two seeded files; the start's clock; openrouter without max_tokens", async () => {
  const t = repo();
  const s = side(["READ src/b.ts", ANSWER]);
  try {
    t.write("src/c.ts", "export const c = 3;\n");
    t.git(["add", "."]);
    t.git(["commit", "-q", "-m", "morph c: src/c.ts\n\nMorph-Card: c\nMorph-Model: m/c"]);
    t.write("src/new.ts", "export const n = 0;\n");
    t.write(".gitignore", "hidden.ts\n");
    t.write("hidden.ts", "secret\n");
    s.write("u.json", '{"files": ["src/new.ts"]}');
    s.write("h.json", '{"files": ["hidden.ts"]}');
    expect(await scoutCommand(t.root, { ...ARGS, seedFile: "h.json" }, deps(s))).toStrictEqual(usage("seed file h.json: not in the tree: hidden.ts"));
    let ms = NOW;
    const ticking = { ...deps(s), now: () => (ms += 1000) };
    const got = await scoutCommand(t.root, { ...ARGS, seedFile: "u.json" }, ticking);
    const id = "20261008-225321-74e423b1";
    expect([got.code, (got.document as { scoutId: string }).scoutId]).toStrictEqual([0, id]);
    const rec = JSON.parse(t.read(`.morph/scout/${id}/scout.json`)) as ScoutRecord;
    expect([rec.createdAt, rec.elapsedMs, rec.seed.files]).toStrictEqual(["2026-10-08T22:53:21.000Z", 3000, ["src/new.ts"]]);
    const own = await scoutCommand(t.root, ARGS, deps(s));
    expect(own.code).toBe(0);
    const rec2 = JSON.parse(t.read(`.morph/scout/${ID}/scout.json`)) as ScoutRecord;
    expect(rec2.seed.files).toStrictEqual(["src/c.ts", "src/b.ts"]);
    const f = fakeFetch({ "https://openrouter.ai/api/v1/chat/completions": { body: { choices: [{ message: { content: ANSWER } }], usage: { prompt_tokens: 9, completion_tokens: 2, cost: 0.5 } } } });
    const env = { PATH: process.env.PATH ?? "", MORPH_PROCESSOR_o_TYPE: "openrouter", MORPH_PROCESSOR_o_API_KEY: "k", MORPH_PROCESSOR_o_MODEL: "m/o" };
    const live = await scoutCommand(t.root, { ...ARGS, processor: "o" }, { env, now: () => NOW, cwd: s.root, transport: { fetch: f.fetch, sleep: async () => undefined } });
    expect((live.document as { usage: unknown }).usage).toStrictEqual({ requests: 1, inputTokens: 9, outputTokens: 2, cost: 0.5 });
    const body = JSON.parse(f.calls[0].body ?? "{}") as Record<string, unknown>;
    expect(["max_tokens" in body, body.model]).toStrictEqual([false, "m/o"]);
    const rec3 = JSON.parse(t.read(`.morph/scout/${ID}/scout.json`)) as ScoutRecord;
    expect([rec3.processor, rec3.model]).toStrictEqual(["o", "m/o"]);
  } finally {
    t.rm();
    s.rm();
  }
});

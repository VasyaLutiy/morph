// P11b2 probe for collect-batch by docs/TASK_P11b2_processor.md §2.2 (Collect Batch) — the saved state of a submit read
// back, ONE GET of the batch, the state updated, a stale card's answers held back, the answers saved through
// deps.saveAnswers for a stub replay, one Collect Document. Record Collect Batch examples 1-6, then the §2.2 rows (another
// processor id, base url, key and clock; variants; a reply without text; a missing reply; each state key checked).
import { test, expect } from "vitest";
import { collectBatch } from "../../src/batches/collect.js";
import type { DetachedDeps, SubmittedBatch } from "../../src/batches/submit.js";
import { saveBatchAnswers, saveBatchRecord } from "../../src/git/archive.js";
import type { Transport } from "../../src/processor/types.js";
import { fixture, fixtureJson, tmpRoot } from "../../tests/helpers.js";
import type { TmpRoot } from "../../tests/helpers.js";

type Step = Error | { status: number; text: string };
const ok = (status: number, name: string): Step => ({ status, text: fixture("processor/" + name) });
function script(steps: Step[]) {
  const calls: { url: string; method: string; headers: Record<string, string>; body: string | undefined }[] = [];
  const transport: Transport = {
    fetch: async (url, init) => {
      calls.push({ url, method: init.method, headers: init.headers, body: init.body });
      const s = steps[Math.min(calls.length, steps.length) - 1];
      if (s instanceof Error) throw s;
      return { status: s.status, text: async () => s.text };
    },
    sleep: async () => undefined,
  };
  return { transport, calls };
}
const ENV = { MORPH_PROCESSOR_b_TYPE: "openrouter", MORPH_PROCESSOR_b_MODEL: "acme/m:batch", MORPH_PROCESSOR_b_API_KEY: "sk-or-test", MORPH_PROCESSOR_b_ROUTE: "batch" };
const ID = "batch-1791388269-cp5qOr5IQ0xoz1ntuc8W";
const STATE = ".morph/batches/" + ID + ".json";
function setup(state: string = fixture("batches/submitted.json")): TmpRoot {
  const t = tmpRoot();
  t.write("docs/clamp.md", "Clamp a value.\n");
  t.write(STATE, state);
  return t;
}
function deps(t: TmpRoot, transport: Transport, env: Record<string, string> = ENV, now = 1791400600000): DetachedDeps {
  return { env, now: () => now, transport, saveState: (s) => saveBatchRecord(t.root, s), saveAnswers: (id, a) => saveBatchAnswers(t.root, id, a) };
}
const err = (code: number, kind: string, message: string) => ({ code, document: { error: { code, kind, message } } });
const docs = fixtureJson("batches/documents.json") as Record<string, { answers: unknown }>;
const live = (fixtureJson("processor/replies.json") as { live: { answer: { customId: string; text: string } }[] }).live;
const textOf = (customId: string): string => live.find((r) => r.answer.customId === customId)?.answer.text ?? "";
const submitted = (): SubmittedBatch => JSON.parse(fixture("batches/submitted.json")) as SubmittedBatch;

test("Collect Batch example 1: a completed batch, its answers saved for a replay", async () => {
  const t = setup();
  try {
    const s = script([ok(200, "batchCompletedLive.json")]);
    expect(await collectBatch(t.root, ID, deps(t, s.transport)), "the result").toStrictEqual({ code: 0, document: docs["Collect Batch 1"] });
    expect(s.calls.map((c) => [c.method, c.url, c.body, c.headers.Authorization]), "one GET, no body").toStrictEqual(
      [["GET", "https://openrouter.ai/api/beta/batches/" + ID, undefined, "Bearer sk-or-test"]]);
    expect(t.read(STATE), "the state file").toBe(fixture("batches/collected.json"));
    expect(t.read(".morph/batches/" + ID + "/clamp-value.v1.md"), "clamp answer").toBe(textOf("clamp-value.v1"));
    expect(t.read(".morph/batches/" + ID + "/sign-of.v1.md"), "sign answer").toBe(textOf("sign-of.v1"));
  } finally {
    t.rm();
  }
});

test("Collect Batch example 2: a pending batch, exit 1, the status saved", async () => {
  const t = setup();
  try {
    expect(await collectBatch(t.root, ID, deps(t, script([ok(200, "batchInProgress.json")]).transport)), "pending").toStrictEqual({ code: 1,
      document: { batchId: ID, outcome: "pending", status: "in_progress", cost: null, answers: [], stale: [], files: [], state: STATE } });
    expect(JSON.parse(t.read(STATE)), "status saved, no collectedAt").toStrictEqual({ ...submitted(), status: "in_progress" });
    expect(t.exists(".morph/batches/" + ID), "no answers dir").toBe(false);
  } finally {
    t.rm();
  }
});

test("Collect Batch example 3: a stale card's answers are not saved", async () => {
  const t = setup();
  try {
    t.write("docs/clamp.md", "Clamp it.\n");
    const got = await collectBatch(t.root, ID, deps(t, script([ok(200, "batchCompletedLive.json")]).transport));
    const doc = got.document as { outcome: string; stale: string[]; answers: unknown; files: string[] };
    expect([got.code, doc.outcome, doc.stale], "code, outcome, stale").toStrictEqual([1, "done", ["clamp-value"]]);
    expect(doc.answers, "answers").toStrictEqual(docs["Collect Batch 1"].answers);
    expect(doc.files, "files").toStrictEqual([".morph/batches/" + ID + "/sign-of.v1.md"]);
    expect(t.exists(".morph/batches/" + ID + "/clamp-value.v1.md"), "no clamp file").toBe(false);
  } finally {
    t.rm();
  }
});

test("Collect Batch example 4: a missing, foreign or unreadable state, a processor gone", async () => {
  const t = setup(fixture("cli/batch.r9.json"));
  try {
    const s = script([ok(200, "batchCompletedLive.json")]);
    expect(await collectBatch(t.root, "batch-none", deps(t, s.transport)), "missing").toStrictEqual(err(4, "UsageError", "batch state not found: .morph/batches/batch-none.json"));
    expect(await collectBatch(t.root, ID, deps(t, s.transport)), "run record").toStrictEqual(err(2, "RefusalError", "batch state " + STATE + " is not a submit's state: cards"));
    t.write(STATE, "{");
    expect(await collectBatch(t.root, ID, deps(t, s.transport)), "unreadable").toStrictEqual(err(2, "RefusalError", "batch state " + STATE + " is not a submit's state: unreadable"));
    t.write(STATE, fixture("batches/submitted.json"));
    expect(await collectBatch(t.root, ID, deps(t, s.transport, {})), "processor gone").toStrictEqual(err(4, "UsageError", "processor b is not configured"));
    expect(s.calls.length, "no call").toBe(0);
  } finally {
    t.rm();
  }
});

test("Collect Batch example 5: an error read is a fault, the state untouched", async () => {
  const t = setup();
  try {
    expect(await collectBatch(t.root, ID, deps(t, script([ok(404, "batchNotFound.json")]).transport)), "404").toStrictEqual(
      err(3, "RuntimeError", "batch " + ID + ": http 404: Batch job batch-1789576284-Ejahe4wq9AgVdp5xGdNm not found."));
    expect(t.read(STATE), "untouched").toBe(fixture("batches/submitted.json"));
  } finally {
    t.rm();
  }
});

test("Collect Batch example 6: a failed batch answers every request with its error", async () => {
  const t = setup();
  try {
    const error = "batch " + ID + " failed: HTTP 400: invalid batch inference job: job-submission-count for account acct-0000, in use: 16, quota: 16";
    expect(await collectBatch(t.root, ID, deps(t, script([ok(200, "batchFailed.json")]).transport)), "failed").toStrictEqual({ code: 1,
      document: { batchId: ID, outcome: "failed", status: "failed", cost: null,
        answers: [{ customId: "clamp-value.v1", finishReason: null, error, chars: null }, { customId: "sign-of.v1", finishReason: null, error, chars: null }],
        stale: [], files: [], state: STATE } });
    expect((JSON.parse(t.read(STATE)) as { collectedAt: number }).collectedAt, "collectedAt").toBe(1791400600000);
  } finally {
    t.rm();
  }
});

test("§2.2 rows: another processor, base url, key and clock; variants; a reply without text; a missing reply; no batch cost", async () => {
  const t = tmpRoot();
  try {
    const id = "batch-1789576284-Ejahe4wq9AgVdp5xGdNm";
    const card = (c: string) => ({ customId: c, intent: "generate", targets: ["out/" + c + ".ts"], contextSlice: [], instruction: "x", acceptance: "true",
      model: null, maxTokens: null, reasoning: null, variants: 1, dependsOn: [] });
    const state = { batchId: id, processor: "night", model: "x/y:batch", customIds: ["a.v1", "b.v1", "d.v1"], status: "validating", cost: null,
      deck: "q.json", submittedAt: 1, cards: [card("a"), card("b"), card("d")], inputs: { a: { "out/a.ts": "absent" }, b: { "out/b.ts": "absent" }, d: { "out/d.ts": "absent" } } };
    t.write(".morph/batches/" + id + ".json", JSON.stringify(state));
    const env = { MORPH_PROCESSOR_night_TYPE: "openrouter", MORPH_PROCESSOR_night_MODEL: "x/y:batch", MORPH_PROCESSOR_night_API_KEY: "sk-2",
      MORPH_PROCESSOR_night_ROUTE: "batch", MORPH_PROCESSOR_night_BASE_URL: "http://127.0.0.1:9/v1" };
    const s = script([ok(200, "batchCompleted.json")]);
    const got = await collectBatch(t.root, id, deps(t, s.transport, env, 7));
    expect(s.calls.map((c) => c.url + " " + c.headers.Authorization), "url and key").toStrictEqual(["http://127.0.0.1:9/beta/batches/" + id + " Bearer sk-2"]);
    const doc = got.document as { outcome: string; cost: unknown; answers: { customId: string; finishReason: unknown; error: unknown; chars: unknown }[]; files: string[] };
    expect([got.code, doc.outcome, doc.cost], "code, outcome, cost").toStrictEqual([1, "done", null]);
    expect(doc.answers.map((a) => [a.customId, a.finishReason, a.error, a.chars === null ? null : "n"]), "answers in state order").toStrictEqual([
      ["a.v1", "stop", null, "n"], ["b.v1", "length", null, null], ["d.v1", null, "batch " + id + " completed: no result", null]]);
    expect(doc.files, "only a text is saved").toStrictEqual([".morph/batches/" + id + "/a.v1.md"]);
    expect((JSON.parse(t.read(".morph/batches/" + id + ".json")) as { collectedAt: number; status: string }).collectedAt, "clock").toBe(7);
  } finally {
    t.rm();
  }
});

test("§2.2 rows: a stale card holds back every variant; a thrown GET; each state key checked; a stub processor refused", async () => {
  const t = setup();
  try {
    const st = submitted();
    st.customIds = ["clamp-value.v1", "clamp-value.v2", "sign-of.v1"];
    t.write(STATE, JSON.stringify(st));
    t.write("out/clamp.ts", "export {};\n");
    const got = await collectBatch(t.root, ID, deps(t, script([ok(200, "batchCompletedLive.json")]).transport));
    expect((got.document as { files: string[] }).files, "no clamp variant").toStrictEqual([".morph/batches/" + ID + "/sign-of.v1.md"]);
    t.write(STATE, fixture("batches/submitted.json"));
    expect(await collectBatch(t.root, ID, deps(t, script([new Error("socket hang up")]).transport)), "thrown").toStrictEqual(
      err(3, "RuntimeError", "batch " + ID + ": transport: socket hang up"));
    expect(t.read(STATE), "untouched").toBe(fixture("batches/submitted.json"));
    const bad = (patch: Record<string, unknown>, name: string) => {
      t.write(STATE, JSON.stringify({ ...submitted(), ...patch }));
      return collectBatch(t.root, ID, deps(t, script([ok(200, "batchCompletedLive.json")]).transport)).then((r) =>
        expect(r, name).toStrictEqual(err(2, "RefusalError", "batch state " + STATE + " is not a submit's state: " + name)));
    };
    await bad({ batchId: "batch-other" }, "batchId");
    await bad({ processor: 7 }, "processor");
    await bad({ customIds: [1] }, "customIds");
    await bad({ inputs: null }, "inputs");
    t.write(STATE, "[]");
    expect(await collectBatch(t.root, ID, deps(t, script([]).transport)), "array").toStrictEqual(err(2, "RefusalError", "batch state " + STATE + " is not a submit's state: unreadable"));
    t.write(STATE, fixture("batches/submitted.json"));
    const stub = { MORPH_PROCESSOR_b_TYPE: "stub", MORPH_PROCESSOR_b_ANSWERS_DIR: "/x", MORPH_PROCESSOR_b_ROUTE: "batch" };
    expect(await collectBatch(t.root, ID, deps(t, script([]).transport, stub)), "stub").toStrictEqual(err(2, "RefusalError", "processor b is not an openrouter processor on route batch"));
  } finally {
    t.rm();
  }
});

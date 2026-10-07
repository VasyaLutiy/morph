// P11b2 probe for submit-deck by docs/TASK_P11b2_processor.md §2.2 (Submit Deck) — the first generation of a deck as ONE
// batch: processor and deck refusals before any call, per-card refusals, one POST never retried, the Submitted Batch saved
// through deps.saveState, one Submit Document. Record Submit Deck examples 1-5, then the §2.2 rows (other processor id,
// model, base url, key, clock, deck path, variants and generations: the code hard-codes none of them).
import { test, expect } from "vitest";
import { submitDeck } from "../../src/batches/submit.js";
import type { DetachedDeps, SubmittedBatch } from "../../src/batches/submit.js";
import { saveBatchRecord } from "../../src/git/archive.js";
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
function setup(): TmpRoot {
  const t = tmpRoot();
  t.write("docs/clamp.md", "Clamp a value.\n");
  t.write("d.json", fixture("batches/deck.json"));
  return t;
}
function deps(t: TmpRoot, transport: Transport, env: Record<string, string> = ENV, now = 1791400000000): DetachedDeps {
  return { env, now: () => now, transport, saveState: (s) => saveBatchRecord(t.root, s), saveAnswers: () => [] };
}
const err = (code: number, kind: string, message: string) => ({ code, document: { error: { code, kind, message } } });
const body = (b: string | undefined) => JSON.parse(b ?? "") as { model: string; requests: { custom_id: string }[] };

test("Submit Deck example 1: the first generation as one batch, its state saved", async () => {
  const t = setup();
  try {
    const s = script([ok(202, "batchSubmittedLive.json")]);
    const got = await submitDeck(t.root, "d.json", "b", deps(t, s.transport));
    expect(got, "the result").toStrictEqual({ code: 0, document: (fixtureJson("batches/documents.json") as Record<string, unknown>)["Submit Deck 1"] });
    expect(s.calls.map((c) => c.method + " " + c.url), "one POST").toStrictEqual(["POST https://openrouter.ai/api/beta/batches"]);
    expect(body(s.calls[0].body).model, "the batch model").toBe("acme/m:batch");
    expect(body(s.calls[0].body).requests.map((r) => r.custom_id), "the first generation").toStrictEqual(["clamp-value.v1", "sign-of.v1"]);
    expect(t.read(".morph/batches/" + ID + ".json"), "the state file").toBe(fixture("batches/submitted.json"));
  } finally {
    t.rm();
  }
});

test("Submit Deck example 2: processor and deck refusals before any call", async () => {
  const t = setup();
  try {
    t.write("e.json", "[]");
    const s = script([ok(202, "batchSubmittedLive.json")]);
    const env = { ...ENV, MORPH_PROCESSOR_s_TYPE: "stub", MORPH_PROCESSOR_s_ANSWERS_DIR: "/x" };
    expect(await submitDeck(t.root, "d.json", "nope", deps(t, s.transport, env)), "nope").toStrictEqual(err(4, "UsageError", "processor nope is not configured"));
    expect(await submitDeck(t.root, "d.json", "s", deps(t, s.transport, env)), "stub").toStrictEqual(err(2, "RefusalError", "processor s is not an openrouter processor on route batch"));
    expect(await submitDeck(t.root, "nope.json", "b", deps(t, s.transport, env)), "no deck").toStrictEqual(err(4, "UsageError", "deck file not found: nope.json"));
    expect(await submitDeck(t.root, "e.json", "b", deps(t, s.transport, env)), "no cards").toStrictEqual(err(2, "RefusalError", "deck has no cards"));
    expect(`${s.calls.length}|${t.exists(".morph")}`, "no call, no .morph").toBe("0|false");
  } finally {
    t.rm();
  }
});

test("Submit Deck example 3: cards refused one by one; none left refuses the submit", async () => {
  const t = setup();
  try {
    const c = (id: string, extra: Record<string, unknown>) => ({ customId: id, intent: "generate", targets: ["out/" + id + ".ts"], instruction: "x", ...extra });
    const x = c("x", { model: "other/m", acceptance: "true" });
    const q = c("q", {});
    t.write("f.json", JSON.stringify([x, q, c("k", { contextSlice: ["docs/missing.md"], acceptance: "true" }), c("a", { acceptance: "true" })]));
    t.write("g.json", JSON.stringify([x, q]));
    const s = script([ok(202, "batchSubmittedLive.json")]);
    const got = await submitDeck(t.root, "f.json", "b", deps(t, s.transport));
    expect(got.code, "code").toBe(0);
    expect((got.document as { refused: unknown }).refused, "refused").toStrictEqual([
      { customId: "x", reason: "batch runs one model: x pins other/m, the batch is acme/m:batch" },
      { customId: "q", reason: "no acceptance" },
      { customId: "k", reason: "compile: contextSlice 'docs/missing.md' does not exist" },
    ]);
    expect(body(s.calls[0].body).requests.map((r) => r.custom_id), "only a").toStrictEqual(["a.v1"]);
    expect(await submitDeck(t.root, "g.json", "b", deps(t, s.transport)), "nothing").toStrictEqual(
      err(2, "RefusalError", "nothing to submit: x batch runs one model: x pins other/m, the batch is acme/m:batch; q no acceptance"));
    expect(s.calls.length, "one call in all").toBe(1);
  } finally {
    t.rm();
  }
});

test("Submit Deck example 4: a failed submit is a fault, nothing saved", async () => {
  const t = setup();
  try {
    expect(await submitDeck(t.root, "d.json", "b", deps(t, script([ok(400, "noBatchEndpoint.json")]).transport)), "400").toStrictEqual(err(3, "RuntimeError",
      "batch submit: http 400: HTTP 400: invalid batch inference job: Model 'z-ai/glm-5.3:batch' does not have a :batch endpoint."));
    expect(await submitDeck(t.root, "d.json", "b", deps(t, script([new Error("socket hang up")]).transport)), "thrown").toStrictEqual(
      err(3, "RuntimeError", "batch submit: transport: socket hang up"));
    expect(t.exists(".morph"), "no .morph").toBe(false);
  } finally {
    t.rm();
  }
});

test("Submit Deck example 5: a state that cannot be saved names the batch", async () => {
  const t = setup();
  try {
    const none: DetachedDeps = { ...deps(t, script([ok(202, "batchSubmittedLive.json")]).transport), saveState: () => null };
    expect(await submitDeck(t.root, "d.json", "b", none), "null").toStrictEqual(err(3, "RuntimeError", "batch " + ID + ": state not saved"));
    const full: DetachedDeps = { ...deps(t, script([ok(202, "batchSubmittedLive.json")]).transport), saveState: () => { throw new Error("disk full"); } };
    expect(await submitDeck(t.root, "d.json", "b", full), "thrown").toStrictEqual(err(3, "RuntimeError", "batch " + ID + ": state not saved: disk full"));
  } finally {
    t.rm();
  }
});

test("§2.2 rows: another processor, base url, key, clock, deck path; variants; three generations; a pin equal to the batch model", async () => {
  const t = tmpRoot();
  try {
    const env = { MORPH_PROCESSOR_night_TYPE: "openrouter", MORPH_PROCESSOR_night_MODEL: "x/y:batch", MORPH_PROCESSOR_night_API_KEY: "sk-2",
      MORPH_PROCESSOR_night_ROUTE: "batch", MORPH_PROCESSOR_night_BASE_URL: "http://127.0.0.1:9/v1" };
    const c = (id: string, extra: Record<string, unknown>) => ({ customId: id, intent: "generate", targets: ["out/" + id + ".ts"], instruction: "x", acceptance: "true", ...extra });
    t.write("decks/q.json", JSON.stringify([c("c", { dependsOn: ["b"] }), c("a", { variants: 2, model: "x/y:batch" }), c("b", { dependsOn: ["a"] }), c("e", { acceptance: " \t" })]));
    const saved: SubmittedBatch[] = [];
    const s = script([ok(202, "batchSubmitted.json")]);
    const d: DetachedDeps = { env, now: () => 42, transport: s.transport, saveState: (st) => { saved.push(JSON.parse(JSON.stringify(st)) as SubmittedBatch); return "S"; }, saveAnswers: () => [] };
    const got = await submitDeck(t.root, "decks/q.json", "night", d);
    expect(got, "document").toStrictEqual({ code: 0, document: { batchId: "batch-1789576284-Ejahe4wq9AgVdp5xGdNm", processor: "night", model: "x/y:batch",
      customIds: ["a.v1", "a.v2"], status: "validating", deferred: ["b", "c"], refused: [{ customId: "e", reason: "no acceptance" }], state: "S" } });
    expect(s.calls.map((x) => x.method + " " + x.url + " " + x.headers.Authorization), "url and key").toStrictEqual(["POST http://127.0.0.1:9/beta/batches Bearer sk-2"]);
    expect(saved.length, "saved once").toBe(1);
    expect([saved[0].deck, saved[0].submittedAt, saved[0].cost, saved[0].cards.map((x) => x.customId), Object.keys(saved[0].inputs)], "state fields")
      .toStrictEqual(["decks/q.json", 42, null, ["a"], ["a"]]);
    expect(Object.keys(saved[0]), "state keys in order").toStrictEqual(["batchId", "processor", "model", "customIds", "status", "cost", "deck", "submittedAt", "cards", "inputs"]);
  } finally {
    t.rm();
  }
});

test("§2.2 rows: registry faults named, a sync openrouter and a batch stub refused, invalid decks, a submit without a batch id", async () => {
  const t = setup();
  try {
    const s = script([{ status: 202, text: "{\"status\": \"validating\"}" }]);
    const env = { ...ENV, MORPH_PROCESSOR_bad_TYPE: "x", MORPH_PROCESSOR_o_TYPE: "openrouter", MORPH_PROCESSOR_o_MODEL: "m", MORPH_PROCESSOR_o_API_KEY: "k" };
    expect(await submitDeck(t.root, "d.json", "bad", deps(t, s.transport, env)), "faults").toStrictEqual(
      err(4, "UsageError", "processor bad is not configured: MORPH_PROCESSOR_bad_TYPE must be one of openrouter, stub (got 'x')"));
    expect(await submitDeck(t.root, "d.json", "o", deps(t, s.transport, env)), "sync").toStrictEqual(err(2, "RefusalError", "processor o is not an openrouter processor on route batch"));
    t.write("c.json", fixture("decks/cycle.json"));
    expect(await submitDeck(t.root, "c.json", "b", deps(t, s.transport, env)), "cycle").toStrictEqual(err(2, "DeckError", "invalid deck: dependsOn: dependsOn cycle a -> b -> a"));
    t.write("two.json", JSON.stringify([{ customId: "a", intent: "generate", targets: ["out/a.ts"] }, { customId: "a b", intent: "generate", targets: ["out/b.ts"], instruction: "x" }]));
    expect(await submitDeck(t.root, "two.json", "b", deps(t, s.transport, env)), "two faults").toStrictEqual(err(2, "DeckError",
      "invalid deck: cards[0].instruction: instruction is required; cards[1].customId: customId 'a b' does not match ^[A-Za-z0-9._-]+$"));
    const stubBatch = { ...env, MORPH_PROCESSOR_ns_TYPE: "stub", MORPH_PROCESSOR_ns_ANSWERS_DIR: "/x", MORPH_PROCESSOR_ns_ROUTE: "batch" };
    expect(await submitDeck(t.root, "d.json", "ns", deps(t, s.transport, stubBatch)), "stub on route batch").toStrictEqual(
      err(2, "RefusalError", "processor ns is not an openrouter processor on route batch"));
    expect(s.calls.length, "no call yet").toBe(0);
    expect(await submitDeck(t.root, "d.json", "b", deps(t, s.transport, env)), "no id").toStrictEqual(err(3, "RuntimeError", "batch submit: no batch id"));
  } finally {
    t.rm();
  }
});

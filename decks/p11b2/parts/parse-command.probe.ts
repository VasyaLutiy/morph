// P11b2 probe for parse-command by docs/TASK_P11b2_processor.md §2.2 (Parse Command, Main) — the words submit and collect,
// their flags, checks and messages; the no-command message lists five commands; main routes submit to Submit Deck and
// collect to Collect Batch with the Detached Deps built from its deps and git's writers. Record Parse Command examples
// 8 (changed), 14 and 15, Main examples 7 and 8, then the §2.2 rows.
import { test, expect } from "vitest";
import { parseCommand } from "../../src/cli/parse.js";
import { main } from "../../src/cli/main.js";
import type { CliDeps, CliIo } from "../../src/cli/types.js";
import type { Transport } from "../../src/processor/types.js";
import { fixture, fixtureJson, tmpRoot } from "../../tests/helpers.js";

type Step = Error | { status: number; text: string };
const ok = (status: number, name: string): Step => ({ status, text: fixture("processor/" + name) });
function script(steps: Step[]) {
  const calls: { url: string; method: string }[] = [];
  const transport: Transport = {
    fetch: async (url, init) => {
      calls.push({ url, method: init.method });
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
const usage = (message: string) => ({ ok: false, error: { error: { code: 4, kind: "UsageError", message } } });
function io(): CliIo & { out: string[]; err: string[] } {
  const out: string[] = [];
  const err: string[] = [];
  return { out, err, stdout: (text) => { out.push(text); }, stderr: (text) => { err.push(text); } };
}

test("Parse Command example 8 (changed): no command lists five commands", () => {
  expect(parseCommand([]), "no command").toStrictEqual(usage("no command (commands: deck check, plan, run, submit, collect)"));
});

test("Parse Command example 14: submit and collect", () => {
  const argv = fixtureJson("cli/parseArgv.json") as Record<string, string[][]>;
  const want = fixtureJson("cli/parse.json") as Record<string, unknown[]>;
  expect(argv["14"].map((a) => parseCommand(a)), "parse.json 14").toStrictEqual(want["14"]);
});

test("Parse Command example 15: the usage errors of submit and collect", () => {
  const argv = fixtureJson("cli/parseArgv.json") as Record<string, string[][]>;
  const want = fixtureJson("cli/parse.json") as Record<string, unknown[]>;
  expect(argv["15"].map((a) => parseCommand(a)), "parse.json 15").toStrictEqual(want["15"]);
});

test("Main example 7: collect of a batch with no state answers a usage error", async () => {
  const t = tmpRoot();
  try {
    const o = io();
    expect(await main(["collect", "--batch", "batch-none", "--root", t.root], { env: {}, now: () => 0, cwd: "/", transport: null }, o), "exit").toBe(4);
    expect(o.out.map((x) => JSON.parse(x) as unknown), "stdout").toStrictEqual(
      [{ error: { code: 4, kind: "UsageError", message: "batch state not found: .morph/batches/batch-none.json" } }]);
    expect(o.err, "stderr").toStrictEqual(["morph collect: exit 4\n"]);
  } finally {
    t.rm();
  }
});

test("Main example 8: submit, then collect with new deps, routed to batches", async () => {
  const t = tmpRoot();
  try {
    t.write("docs/clamp.md", "Clamp a value.\n");
    t.write("d.json", fixture("batches/deck.json"));
    const docs = fixtureJson("batches/documents.json") as Record<string, unknown>;
    const o = io();
    const submit: CliDeps = { env: ENV, now: () => 1791400000000, cwd: "/", transport: script([ok(202, "batchSubmittedLive.json")]).transport };
    const collect: CliDeps = { env: ENV, now: () => 1791400600000, cwd: "/", transport: script([ok(200, "batchCompletedLive.json")]).transport };
    const codes = [await main(["submit", "--deck", "d.json", "--processor", "b", "--root", t.root], submit, o),
      await main(["collect", "--batch", ID, "--root", t.root], collect, o)];
    expect(codes, "exits").toStrictEqual([0, 0]);
    expect(o.out.map((x) => JSON.parse(x) as unknown), "documents").toStrictEqual([docs["Submit Deck 1"], docs["Collect Batch 1"]]);
    expect(o.err, "stderr").toStrictEqual(["morph submit: exit 0\n", "morph collect: exit 0\n"]);
    expect(t.read(".morph/batches/" + ID + ".json"), "state").toBe(fixture("batches/collected.json"));
    expect(`${t.exists(".morph/batches/" + ID + "/clamp-value.v1.md")}|${t.exists(".morph/batches/" + ID + "/sign-of.v1.md")}`, "answers").toBe("true|true");
  } finally {
    t.rm();
  }
});

test("§2.2 rows: flags and checks of submit and collect; deck check, run and plan unchanged", () => {
  expect(parseCommand(["collect", "--pretty", "--batch", "q.1_x-Y"]), "collect").toStrictEqual({ ok: true, command: { name: "collect", root: ".", pretty: true, batch: "q.1_x-Y" } });
  expect(parseCommand(["submit", "--root", "/w", "--processor", "night", "--deck", "decks/q.json", "--pretty"]), "submit").toStrictEqual(
    { ok: true, command: { name: "submit", root: "/w", pretty: true, deck: "decks/q.json", processor: "night" } });
  expect(parseCommand(["submit", "x", "--deck", "d", "--processor", "b"]), "extra").toStrictEqual(usage("unexpected argument: x"));
  expect(parseCommand(["submit", "--deck", "d", "--processor", "b", "--batch", "z"]), "batch on submit").toStrictEqual(usage("flag --batch does not apply to submit"));
  expect(parseCommand(["run", "--deck", "d", "--processor", "s", "--batch", "z"]), "batch on run").toStrictEqual(usage("flag --batch does not apply to run"));
  expect(parseCommand(["collect", "--batch", "x", "--batch", "y"]), "twice").toStrictEqual(usage("flag --batch given twice"));
  expect(parseCommand(["collect", "--batch"]), "no value").toStrictEqual(usage("flag --batch needs a value"));
  expect(parseCommand(["collect", "--batch", "a b"]), "space").toStrictEqual(usage("--batch must match ^[A-Za-z0-9._-]+$ (got 'a b')"));
  expect(parseCommand(["submit"]), "submit bare").toStrictEqual(usage("missing --deck"));
  const argv = fixtureJson("cli/parseArgv.json") as Record<string, string[][]>;
  const want = fixtureJson("cli/parse.json") as Record<string, unknown>;
  for (const k of ["1", "2", "3", "4", "5", "6", "7", "9", "10", "11", "12", "13"]) {
    const got = argv[k].map((a) => parseCommand(a));
    expect(got.length === 1 ? got[0] : got, "parse.json " + k).toStrictEqual(want[k]);
  }
});

test("§2.2 rows: main routes a submit refusal and a collect of another root; deps reach both commands", async () => {
  const t = tmpRoot();
  try {
    const o = io();
    expect(await main(["submit", "--deck", "d.json", "--processor", "zz", "--root", t.root], { env: {}, now: () => 0, cwd: "/", transport: null }, o), "exit").toBe(4);
    expect(o.out.map((x) => JSON.parse(x) as unknown), "stdout").toStrictEqual([{ error: { code: 4, kind: "UsageError", message: "processor zz is not configured" } }]);
    t.write("w/docs/clamp.md", "Clamp a value.\n");
    t.write("w/.morph/batches/" + ID + ".json", fixture("batches/submitted.json"));
    const s = script([ok(200, "batchInProgress.json")]);
    const o2 = io();
    expect(await main(["collect", "--batch", ID, "--root", "w"], { env: ENV, now: () => 5, cwd: t.root, transport: s.transport }, o2), "pending").toBe(1);
    expect((JSON.parse(o2.out[0]) as { outcome: string }).outcome, "outcome").toBe("pending");
    expect(s.calls.map((c) => c.method + " " + c.url), "the deps' transport").toStrictEqual(["GET https://openrouter.ai/api/beta/batches/" + ID]);
    expect((JSON.parse(t.read("w/.morph/batches/" + ID + ".json")) as { status: string }).status, "saved under the root").toBe("in_progress");
    expect(o2.err, "stderr").toStrictEqual(["morph collect: exit 1\n"]);
  } finally {
    t.rm();
  }
});

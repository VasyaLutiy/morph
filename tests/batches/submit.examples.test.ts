import { expect, test } from "vitest";

import { submitDeck, type DetachedDeps } from "../../src/batches/submit.js";
import { saveBatchRecord } from "../../src/git/archive.js";
import type { Transport } from "../../src/processor/types.js";
import { fixture, fixtureJson, tmpRoot } from "../helpers.js";

type Step = { status: number; text: string } | Error;

interface Call {
  url: string;
  method: string;
  headers: Record<string, string>;
  body: string | undefined;
}

const ENV: Record<string, string> = {
  MORPH_PROCESSOR_b_TYPE: "openrouter",
  MORPH_PROCESSOR_b_MODEL: "acme/m:batch",
  MORPH_PROCESSOR_b_API_KEY: "sk-or-test",
  MORPH_PROCESSOR_b_ROUTE: "batch",
};

const NOW = 1791400000000;

function ok(status: number, name: string): Step {
  return { status, text: fixture("processor/" + name) };
}

function script(steps: Step[]): { transport: Transport; calls: Call[] } {
  const calls: Call[] = [];
  const transport: Transport = {
    fetch: async (url, init) => {
      calls.push({ url, method: init.method, headers: init.headers, body: init.body });
      const step = steps[Math.min(calls.length, steps.length) - 1] as Step;
      if (step instanceof Error) throw step;
      return { status: step.status, text: async () => step.text };
    },
    sleep: async () => undefined,
  };
  return { transport, calls };
}

function baseDeps(
  root: string,
  env: Record<string, string>,
  transport: Transport | null,
  now: number,
): DetachedDeps {
  return {
    env,
    now: () => now,
    transport,
    saveState: (state) => saveBatchRecord(root, state),
    saveAnswers: () => [],
  };
}

test("Submit Deck example 1: the first generation is one POST and its state is saved", async () => {
  const t = tmpRoot();
  try {
    t.write("docs/clamp.md", "Clamp a value.\n");
    t.write("d.json", fixture("batches/deck.json"));
    const { transport, calls } = script([ok(202, "batchSubmittedLive.json")]);

    const result = await submitDeck(t.root, "d.json", "b", baseDeps(t.root, ENV, transport, NOW));

    expect(result.code).toBe(0);
    const documents = fixtureJson("batches/documents.json") as Record<string, unknown>;
    expect(result.document).toStrictEqual(documents["Submit Deck 1"]);

    expect(calls.length).toBe(1);
    const call = calls[0] as Call;
    expect(call.url).toBe("https://openrouter.ai/api/beta/batches");
    expect(call.method).toBe("POST");
    const body = String(call.body);
    expect(body).toContain("acme/m:batch");
    expect(body).toContain("clamp-value.v1");
    expect(body).toContain("sign-of.v1");
    expect(body.indexOf("clamp-value.v1")).toBeLessThan(body.indexOf("sign-of.v1"));

    expect(t.read(".morph/batches/batch-1791388269-cp5qOr5IQ0xoz1ntuc8W.json")).toBe(
      fixture("batches/submitted.json"),
    );
  } finally {
    t.rm();
  }
});

test("Submit Deck example 2: a bad processor, a stub, a missing deck and an empty deck are refused", async () => {
  const t = tmpRoot();
  try {
    t.write("docs/clamp.md", "Clamp a value.\n");
    t.write("d.json", fixture("batches/deck.json"));
    t.write("e.json", "[]");
    const { transport, calls } = script([ok(202, "batchSubmittedLive.json")]);

    const unknown = await submitDeck(t.root, "d.json", "nope", baseDeps(t.root, ENV, transport, NOW));
    expect(unknown.code).toBe(4);
    expect(unknown.document).toStrictEqual({
      error: { code: 4, kind: "UsageError", message: "processor nope is not configured" },
    });

    const stubEnv: Record<string, string> = {
      ...ENV,
      MORPH_PROCESSOR_s_TYPE: "stub",
      MORPH_PROCESSOR_s_ANSWERS_DIR: "/x",
    };
    const stub = await submitDeck(t.root, "d.json", "s", baseDeps(t.root, stubEnv, transport, NOW));
    expect(stub.code).toBe(2);
    expect(stub.document).toStrictEqual({
      error: {
        code: 2,
        kind: "RefusalError",
        message: "processor s is not an openrouter processor on route batch",
      },
    });

    const missing = await submitDeck(t.root, "nope.json", "b", baseDeps(t.root, ENV, transport, NOW));
    expect(missing.code).toBe(4);
    expect(missing.document).toStrictEqual({
      error: { code: 4, kind: "UsageError", message: "deck file not found: nope.json" },
    });

    const empty = await submitDeck(t.root, "e.json", "b", baseDeps(t.root, ENV, transport, NOW));
    expect(empty.code).toBe(2);
    expect(empty.document).toStrictEqual({
      error: { code: 2, kind: "RefusalError", message: "deck has no cards" },
    });

    expect(calls.length).toBe(0);
    expect(t.exists(".morph")).toBe(false);
  } finally {
    t.rm();
  }
});

test("Submit Deck example 3: refused cards are listed and the kept one is still submitted", async () => {
  const t = tmpRoot();
  try {
    t.write("docs/clamp.md", "Clamp a value.\n");
    t.write(
      "f.json",
      JSON.stringify([
        {
          customId: "x",
          intent: "generate",
          targets: ["out/x.ts"],
          instruction: "Write x.",
          acceptance: "true",
          model: "other/m",
        },
        {
          customId: "q",
          intent: "generate",
          targets: ["out/q.ts"],
          instruction: "Write q.",
          acceptance: "",
        },
        {
          customId: "k",
          intent: "generate",
          targets: ["out/k.ts"],
          contextSlice: ["docs/missing.md"],
          instruction: "Write k.",
          acceptance: "true",
        },
        {
          customId: "a",
          intent: "generate",
          targets: ["out/a.ts"],
          instruction: "Write a.",
          acceptance: "true",
        },
      ]),
    );
    t.write(
      "g.json",
      JSON.stringify([
        {
          customId: "x",
          intent: "generate",
          targets: ["out/x.ts"],
          instruction: "Write x.",
          acceptance: "true",
          model: "other/m",
        },
        {
          customId: "q",
          intent: "generate",
          targets: ["out/q.ts"],
          instruction: "Write q.",
          acceptance: "",
        },
      ]),
    );
    const { transport, calls } = script([ok(202, "batchSubmittedLive.json")]);

    const first = await submitDeck(t.root, "f.json", "b", baseDeps(t.root, ENV, transport, NOW));
    expect(first.code).toBe(0);
    const document = first.document as { customIds: string[]; refused: unknown };
    expect(document.customIds).toStrictEqual(["a.v1"]);
    expect(document.refused).toStrictEqual([
      {
        customId: "x",
        reason: "batch runs one model: x pins other/m, the batch is acme/m:batch",
      },
      { customId: "q", reason: "no acceptance" },
      {
        customId: "k",
        reason: "compile: contextSlice 'docs/missing.md' does not exist",
      },
    ]);

    const body = String((calls[0] as Call).body);
    expect(body).toContain("a.v1");
    expect(body).not.toContain("x.v1");
    expect(body).not.toContain("q.v1");
    expect(body).not.toContain("k.v1");

    const second = await submitDeck(t.root, "g.json", "b", baseDeps(t.root, ENV, transport, NOW));
    expect(second.code).toBe(2);
    expect(second.document).toStrictEqual({
      error: {
        code: 2,
        kind: "RefusalError",
        message:
          "nothing to submit: x batch runs one model: x pins other/m, the batch is acme/m:batch; q no acceptance",
      },
    });
    expect(calls.length).toBe(1);
  } finally {
    t.rm();
  }
});

test("Submit Deck example 4: a refused POST and a transport error are runtime errors", async () => {
  const t = tmpRoot();
  try {
    t.write("docs/clamp.md", "Clamp a value.\n");
    t.write("d.json", fixture("batches/deck.json"));

    const bad = script([ok(400, "noBatchEndpoint.json")]);
    const refused = await submitDeck(t.root, "d.json", "b", baseDeps(t.root, ENV, bad.transport, NOW));
    expect(refused.code).toBe(3);
    expect(refused.document).toStrictEqual({
      error: {
        code: 3,
        kind: "RuntimeError",
        message:
          "batch submit: http 400: HTTP 400: invalid batch inference job: Model 'z-ai/glm-5.3:batch' does not have a :batch endpoint.",
      },
    });

    const hung = script([new Error("socket hang up")]);
    const thrown = await submitDeck(t.root, "d.json", "b", baseDeps(t.root, ENV, hung.transport, NOW));
    expect(thrown.code).toBe(3);
    expect(thrown.document).toStrictEqual({
      error: { code: 3, kind: "RuntimeError", message: "batch submit: transport: socket hang up" },
    });

    expect(t.exists(".morph")).toBe(false);
  } finally {
    t.rm();
  }
});

test("Submit Deck example 5: an unsaved state is a runtime error", async () => {
  const t = tmpRoot();
  try {
    t.write("docs/clamp.md", "Clamp a value.\n");
    t.write("d.json", fixture("batches/deck.json"));
    const { transport } = script([ok(202, "batchSubmittedLive.json")]);
    const deps = baseDeps(t.root, ENV, transport, NOW);

    const unsaved = await submitDeck(t.root, "d.json", "b", { ...deps, saveState: () => null });
    expect(unsaved.code).toBe(3);
    expect(unsaved.document).toStrictEqual({
      error: {
        code: 3,
        kind: "RuntimeError",
        message: "batch batch-1791388269-cp5qOr5IQ0xoz1ntuc8W: state not saved",
      },
    });

    const failed = await submitDeck(t.root, "d.json", "b", {
      ...deps,
      saveState: () => {
        throw new Error("disk full");
      },
    });
    expect(failed.code).toBe(3);
    expect(failed.document).toStrictEqual({
      error: {
        code: 3,
        kind: "RuntimeError",
        message: "batch batch-1791388269-cp5qOr5IQ0xoz1ntuc8W: state not saved: disk full",
      },
    });
  } finally {
    t.rm();
  }
});

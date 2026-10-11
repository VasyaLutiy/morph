import { expect, test } from "vitest";

import { collectBatch } from "../../src/batches/collect.js";
import type { CollectDocument } from "../../src/batches/collect.js";
import type { DetachedDeps } from "../../src/batches/submit.js";
import { saveBatchAnswers, saveBatchRecord } from "../../src/git/archive.js";
import type { Transport } from "../../src/processor/types.js";
import { fixture, fixtureJson, tmpRoot } from "../helpers.js";

const BATCH_ID = "batch-1791388269-cp5qOr5IQ0xoz1ntuc8W";
const STATE = ".morph/batches/" + BATCH_ID + ".json";
const ANSWER_DIR = ".morph/batches/" + BATCH_ID;

const ENV: Record<string, string> = {
  MORPH_PROCESSOR_b_TYPE: "openrouter",
  MORPH_PROCESSOR_b_MODEL: "acme/m:batch",
  MORPH_PROCESSOR_b_API_KEY: "sk-or-test",
  MORPH_PROCESSOR_b_ROUTE: "batch",
};

const documents = fixtureJson("batches/documents.json") as {
  "Collect Batch 1": CollectDocument;
};

type Step = Error | { status: number; text: string };

interface Call {
  url: string;
  method: string;
  headers: Record<string, string>;
  body: string | undefined;
}

function ok(status: number, name: string): Step {
  return { status, text: fixture("processor/" + name) };
}

function script(steps: Step[]): { transport: Transport; calls: Call[] } {
  const calls: Call[] = [];
  const transport: Transport = {
    fetch: async (url, init) => {
      calls.push({ url, method: init.method, headers: init.headers, body: init.body });
      const step = steps[Math.min(calls.length, steps.length) - 1];
      if (step instanceof Error) throw step;
      return { status: step.status, text: async () => step.text };
    },
    sleep: async () => undefined,
  };
  return { transport, calls };
}

function deps(
  root: string,
  transport: Transport | null,
  now: number,
  env: Record<string, string> = ENV
): DetachedDeps {
  return {
    env,
    now: () => now,
    transport,
    saveState: (state) => saveBatchRecord(root, state),
    saveAnswers: (batchId, answers) => saveBatchAnswers(root, batchId, answers),
  };
}

test("Collect Batch example 1: a completed batch writes both answers and the collected state", async () => {
  const t = tmpRoot();
  try {
    t.write("docs/clamp.md", "Clamp a value.\n");
    t.write(STATE, fixture("batches/submitted.json"));
    const { transport, calls } = script([ok(200, "batchCompletedLive.json")]);

    const result = await collectBatch(t.root, BATCH_ID, deps(t.root, transport, 1791400600000));

    expect(result.code).toBe(0);
    expect(result.document).toStrictEqual(documents["Collect Batch 1"]);
    expect(calls.length).toBe(1);
    expect(calls[0].url).toBe("https://openrouter.ai/api/beta/batches/" + BATCH_ID);
    expect(calls[0].method).toBe("GET");
    expect(calls[0].body).toBeUndefined();
    expect(calls[0].headers.Authorization ?? calls[0].headers.authorization).toBe("Bearer sk-or-test");
    expect(t.read(STATE)).toBe(fixture("batches/collected.json"));

    const replies = fixtureJson("processor/replies.json") as {
      live: { answer: { customId: string; text: string } }[];
    };
    const liveText = (customId: string): string => {
      const reply = replies.live.find((candidate) => candidate.answer.customId === customId);
      return reply === undefined ? "" : reply.answer.text;
    };
    expect(t.read(ANSWER_DIR + "/clamp-value.v1.md")).toBe(liveText("clamp-value.v1"));
    expect(t.read(ANSWER_DIR + "/sign-of.v1.md")).toBe(liveText("sign-of.v1"));
  } finally {
    t.rm();
  }
});

test("Collect Batch example 2: a pending batch saves the status and writes nothing else", async () => {
  const t = tmpRoot();
  try {
    t.write("docs/clamp.md", "Clamp a value.\n");
    t.write(STATE, fixture("batches/submitted.json"));
    const { transport } = script([ok(200, "batchInProgress.json")]);

    const result = await collectBatch(t.root, BATCH_ID, deps(t.root, transport, 1791400600000));

    expect(result.code).toBe(1);
    expect(result.document).toStrictEqual({
      batchId: BATCH_ID,
      outcome: "pending",
      status: "in_progress",
      cost: null,
      answers: [],
      stale: [],
      files: [],
      state: STATE,
    });
    const saved = JSON.parse(fixture("batches/submitted.json")) as Record<string, unknown>;
    saved.status = "in_progress";
    expect(t.read(STATE)).toBe(JSON.stringify(saved, null, 2) + "\n");
    expect(t.exists(ANSWER_DIR)).toBe(false);
  } finally {
    t.rm();
  }
});

test("Collect Batch example 3: an edited context file makes its card stale and skips its answer", async () => {
  const t = tmpRoot();
  try {
    t.write("docs/clamp.md", "Clamp a value.\n");
    t.write(STATE, fixture("batches/submitted.json"));
    t.write("docs/clamp.md", "Clamp it.\n");
    const { transport } = script([ok(200, "batchCompletedLive.json")]);

    const result = await collectBatch(t.root, BATCH_ID, deps(t.root, transport, 1791400600000));

    expect(result.code).toBe(1);
    const document = result.document as CollectDocument;
    expect(document.outcome).toBe("done");
    expect(document.stale).toStrictEqual(["clamp-value"]);
    expect(document.answers).toStrictEqual(documents["Collect Batch 1"].answers);
    expect(document.files).toStrictEqual([ANSWER_DIR + "/sign-of.v1.md"]);
    expect(t.exists(ANSWER_DIR + "/clamp-value.v1.md")).toBe(false);
    expect(t.exists(ANSWER_DIR + "/sign-of.v1.md")).toBe(true);
  } finally {
    t.rm();
  }
});

test("Collect Batch example 4: a missing, foreign, unreadable or unconfigured state is refused without a call", async () => {
  const t = tmpRoot();
  try {
    t.write("docs/clamp.md", "Clamp a value.\n");
    const { transport, calls } = script([ok(200, "batchCompletedLive.json")]);

    const missing = await collectBatch(t.root, "batch-none", deps(t.root, transport, 1791400600000));
    expect(missing.code).toBe(4);
    expect(missing.document).toStrictEqual({
      error: {
        code: 4,
        kind: "UsageError",
        message: "batch state not found: .morph/batches/batch-none.json",
      },
    });

    t.write(STATE, fixture("cli/batch.r9.json"));
    const foreign = await collectBatch(t.root, BATCH_ID, deps(t.root, transport, 1791400600000));
    expect(foreign.code).toBe(2);
    expect(foreign.document).toStrictEqual({
      error: {
        code: 2,
        kind: "RefusalError",
        message: "batch state " + STATE + " is not a submit's state: cards",
      },
    });

    t.write(STATE, "{");
    const unreadable = await collectBatch(t.root, BATCH_ID, deps(t.root, transport, 1791400600000));
    expect(unreadable.code).toBe(2);
    expect(unreadable.document).toStrictEqual({
      error: {
        code: 2,
        kind: "RefusalError",
        message: "batch state " + STATE + " is not a submit's state: unreadable",
      },
    });

    t.write(STATE, fixture("batches/submitted.json"));
    const unconfigured = await collectBatch(
      t.root,
      BATCH_ID,
      deps(t.root, transport, 1791400600000, {})
    );
    expect(unconfigured.code).toBe(4);
    expect(unconfigured.document).toStrictEqual({
      error: { code: 4, kind: "UsageError", message: "processor b is not configured" },
    });

    expect(calls.length).toBe(0);
  } finally {
    t.rm();
  }
});

test("Collect Batch example 5: a 404 leaves the state untouched", async () => {
  const t = tmpRoot();
  try {
    t.write("docs/clamp.md", "Clamp a value.\n");
    t.write(STATE, fixture("batches/submitted.json"));
    const { transport } = script([ok(404, "batchNotFound.json")]);

    const result = await collectBatch(t.root, BATCH_ID, deps(t.root, transport, 1791400600000));

    expect(result.code).toBe(3);
    expect(result.document).toStrictEqual({
      error: {
        code: 3,
        kind: "RuntimeError",
        message:
          "batch " +
          BATCH_ID +
          ": http 404: Batch job batch-1789576284-Ejahe4wq9AgVdp5xGdNm not found.",
      },
    });
    expect(t.read(STATE)).toBe(fixture("batches/submitted.json"));
  } finally {
    t.rm();
  }
});

test("Collect Batch example 6: a failed batch answers every customId with the read error", async () => {
  const t = tmpRoot();
  try {
    t.write("docs/clamp.md", "Clamp a value.\n");
    t.write(STATE, fixture("batches/submitted.json"));
    const { transport } = script([ok(200, "batchFailed.json")]);

    const result = await collectBatch(t.root, BATCH_ID, deps(t.root, transport, 1791400600000));

    expect(result.code).toBe(1);
    const message =
      "batch " +
      BATCH_ID +
      " failed: HTTP 400: invalid batch inference job: job-submission-count for account acct-0000, in use: 16, quota: 16";
    expect(result.document).toStrictEqual({
      batchId: BATCH_ID,
      outcome: "failed",
      status: "failed",
      cost: null,
      answers: [
        { customId: "clamp-value.v1", finishReason: null, error: message, chars: null },
        { customId: "sign-of.v1", finishReason: null, error: message, chars: null },
      ],
      stale: [],
      files: [],
      state: STATE,
    });
    const saved = JSON.parse(t.read(STATE)) as Record<string, unknown>;
    expect(saved.collectedAt).toBe(1791400600000);
  } finally {
    t.rm();
  }
});

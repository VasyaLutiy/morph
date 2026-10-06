// tests/acceptance/verify.examples.test.ts — Verify Card example 1 of the record:
// three variants (corrupt, rejected, green) keep the first green one, the
// corrupt stand-in log, the rolled-back diff of the rejected one, and the
// accepted variant's files. Example 2: a truncated variant and a rejected
// two-file variant leave the tree byte for byte at the snapshot. Example 3:
// a green first variant returns at once and the second is never run. Plus
// own tests on §2.2: stand-ins write nothing, rollback restores and removes,
// the accepted variant's files stay, an unchanged file contributes no diff,
// a no-change variant yields diff "", empty variants, a non-{0,1} exit, and
// the timed-out variant.

import { expect, test } from "vitest";
import { verifyCard } from "../../src/acceptance/verify.js";
import type { VerifyInput, VerifyOutcome } from "../../src/acceptance/types.js";
import type { ParsedAnswer } from "../../src/compiler/types.js";
import { tmpRoot, type TmpRoot } from "../helpers.js";

const COMMAND = 'grep good src/a.ts || { echo "FAIL: no good in src/a.ts"; exit 1; }';
const ENV: Record<string, string> = { PATH: "/usr/bin:/bin" };

function freshRoot(): TmpRoot {
  const r = tmpRoot();
  r.write("src/a.ts", "old\n");
  return r;
}

test("Verify Card example 1: corrupt, rejected, then green keeps c.v3 and its files", async () => {
  const r = freshRoot();
  try {
    const input: VerifyInput = {
      root: r.root,
      targets: ["src/a.ts"],
      command: COMMAND,
      variants: [
        { variant: "c.v1", answer: { corrupt: "missing section for src/a.ts" } },
        { variant: "c.v2", answer: { files: { "src/a.ts": "bad\n" } } },
        { variant: "c.v3", answer: { files: { "src/a.ts": "good\n" } } },
      ],
      env: ENV,
    };
    const out: VerifyOutcome = await verifyCard(input);
    expect(JSON.stringify(out.accepted)).toBe(JSON.stringify({ variant: "c.v3" }));
    expect(out.results.length).toBe(3);
    expect(out.results[0].variant).toBe("c.v1");
    expect(out.results[0].exit).toBeNull();
    expect(out.results[0].log).toBe("answer corrupt: missing section for src/a.ts");
    expect(out.results[0].diff).toBeNull();
    expect(out.results[1].variant).toBe("c.v2");
    expect(out.results[1].exit).toBe(1);
    expect(out.results[1].log).toBe("FAIL: no good in src/a.ts\n");
    expect(out.results[1].diff).toBe(
      "--- a/src/a.ts\n+++ b/src/a.ts\n@@ -1,1 +1,1 @@\n-old\n+bad\n",
    );
    expect(out.results[2].variant).toBe("c.v3");
    expect(out.results[2].exit).toBe(0);
    expect(out.results[2].log).toBe("good\n");
    expect(out.results[2].diff).toBeNull();
    expect(r.read("src/a.ts")).toBe("good\n");
  } finally {
    r.rm();
  }
});

test("Verify Card example 2: truncated, then a rejected two-file variant, leaves the snapshot", async () => {
  const r = freshRoot();
  try {
    const input: VerifyInput = {
      root: r.root,
      targets: ["src/a.ts", "src/b.ts"],
      command: COMMAND,
      variants: [
        { variant: "c.v1", answer: { truncated: true } },
        {
          variant: "c.v2",
          answer: { files: { "src/a.ts": "bad\n", "src/b.ts": "x\n" } },
        },
      ],
      env: ENV,
    };
    const out: VerifyOutcome = await verifyCard(input);
    expect(JSON.stringify(out.accepted)).toBe(JSON.stringify(null));
    expect(out.results.length).toBe(2);
    expect(out.results[0].variant).toBe("c.v1");
    expect(out.results[0].exit).toBeNull();
    expect(out.results[0].log).toBe("answer truncated");
    expect(out.results[0].diff).toBeNull();
    expect(out.results[1].variant).toBe("c.v2");
    expect(out.results[1].exit).toBe(1);
    expect(out.results[1].log).toBe("FAIL: no good in src/a.ts\n");
    expect(out.results[1].diff).toBe(
      "--- a/src/a.ts\n+++ b/src/a.ts\n@@ -1,1 +1,1 @@\n-old\n+bad\n" +
        "--- /dev/null\n+++ b/src/b.ts\n@@ -0,0 +1,1 @@\n+x\n",
    );
    expect(r.read("src/a.ts")).toBe("old\n");
    expect(r.exists("src/b.ts")).toBe(false);
  } finally {
    r.rm();
  }
});

test("Verify Card example 3: a green first variant returns before the second runs", async () => {
  const r = freshRoot();
  try {
    const input: VerifyInput = {
      root: r.root,
      targets: ["src/a.ts"],
      command: COMMAND,
      variants: [
        { variant: "c.v1", answer: { files: { "src/a.ts": "good\n" } } },
        { variant: "c.v2", answer: { files: { "src/a.ts": "good\n" } } },
      ],
      env: ENV,
    };
    const out: VerifyOutcome = await verifyCard(input);
    expect(JSON.stringify(out.accepted)).toBe(JSON.stringify({ variant: "c.v1" }));
    expect(out.results.length).toBe(1);
    expect(out.results[0].variant).toBe("c.v1");
    expect(out.results[0].exit).toBe(0);
    expect(out.results[0].log).toBe("good\n");
    expect(out.results[0].diff).toBeNull();
    expect(r.read("src/a.ts")).toBe("good\n");
  } finally {
    r.rm();
  }
});

test("corrupt and truncated stand-ins write nothing and are never run", async () => {
  const r = freshRoot();
  try {
    const variants: Array<{ variant: string; answer: ParsedAnswer }> = [
      { variant: "c.v1", answer: { corrupt: "missing section for src/a.ts" } },
      { variant: "c.v2", answer: { truncated: true } },
    ];
    const input: VerifyInput = {
      root: r.root,
      targets: ["src/a.ts"],
      command: COMMAND,
      variants,
      env: ENV,
    };
    const out: VerifyOutcome = await verifyCard(input);
    expect(JSON.stringify(out.accepted)).toBe(JSON.stringify(null));
    expect(out.results.length).toBe(2);
    expect(out.results[0].log).toBe("answer corrupt: missing section for src/a.ts");
    expect(out.results[1].log).toBe("answer truncated");
    expect(r.read("src/a.ts")).toBe("old\n");
  } finally {
    r.rm();
  }
});

test("a rejected variant that created a new file loses it to the rollback", async () => {
  const r = freshRoot();
  try {
    const input: VerifyInput = {
      root: r.root,
      targets: ["src/a.ts", "src/b.ts"],
      command: COMMAND,
      variants: [
        {
          variant: "c.v1",
          answer: { files: { "src/a.ts": "bad\n", "src/b.ts": "x\n" } },
        },
      ],
      env: ENV,
    };
    const out: VerifyOutcome = await verifyCard(input);
    expect(JSON.stringify(out.accepted)).toBe(JSON.stringify(null));
    expect(out.results[0].exit).toBe(1);
    expect(r.read("src/a.ts")).toBe("old\n");
    expect(r.exists("src/b.ts")).toBe(false);
  } finally {
    r.rm();
  }
});

test("a green variant's new file in a new directory stays in the tree", async () => {
  const r = freshRoot();
  try {
    const input: VerifyInput = {
      root: r.root,
      targets: ["src/a.ts"],
      command: "grep good src/deep/b.ts",
      variants: [
        {
          variant: "c.v1",
          answer: { files: { "src/deep/b.ts": "good\n" } },
        },
      ],
      env: ENV,
    };
    const out: VerifyOutcome = await verifyCard(input);
    expect(JSON.stringify(out.accepted)).toBe(JSON.stringify({ variant: "c.v1" }));
    expect(out.results[0].exit).toBe(0);
    expect(out.results[0].log).toBe("good\n");
    expect(r.read("src/deep/b.ts")).toBe("good\n");
  } finally {
    r.rm();
  }
});

test("a variant whose file did not change is rejected with an empty diff", async () => {
  const r = freshRoot();
  try {
    const input: VerifyInput = {
      root: r.root,
      targets: ["src/a.ts"],
      command: COMMAND,
      variants: [
        { variant: "c.v1", answer: { files: { "src/a.ts": "old\n" } } },
      ],
      env: ENV,
    };
    const out: VerifyOutcome = await verifyCard(input);
    expect(JSON.stringify(out.accepted)).toBe(JSON.stringify(null));
    expect(out.results.length).toBe(1);
    expect(out.results[0].exit).toBe(1);
    expect(out.results[0].diff).toBe("");
    expect(r.read("src/a.ts")).toBe("old\n");
  } finally {
    r.rm();
  }
});

test("the diff of a failed variant shows only the file whose lines changed", async () => {
  const r = freshRoot();
  try {
    const input: VerifyInput = {
      root: r.root,
      targets: ["src/a.ts", "src/b.ts"],
      command: COMMAND,
      variants: [
        {
          variant: "c.v1",
          answer: { files: { "src/a.ts": "old\n", "src/b.ts": "x\n" } },
        },
      ],
      env: ENV,
    };
    const out: VerifyOutcome = await verifyCard(input);
    expect(out.results[0].diff).toBe(
      "--- /dev/null\n+++ b/src/b.ts\n@@ -0,0 +1,1 @@\n+x\n",
    );
  } finally {
    r.rm();
  }
});

test("no variants means no results and a tree left at the snapshot", async () => {
  const r = freshRoot();
  try {
    const input: VerifyInput = {
      root: r.root,
      targets: ["src/a.ts"],
      command: COMMAND,
      variants: [],
      env: ENV,
    };
    const out: VerifyOutcome = await verifyCard(input);
    expect(JSON.stringify(out.accepted)).toBe(JSON.stringify(null));
    expect(out.results.length).toBe(0);
    expect(r.read("src/a.ts")).toBe("old\n");
  } finally {
    r.rm();
  }
});

test("a rejected variant carries the command's own non-{0,1} exit and log", async () => {
  const r = freshRoot();
  try {
    const input: VerifyInput = {
      root: r.root,
      targets: ["src/a.ts"],
      command: "echo out; exit 3",
      variants: [{ variant: "c.v1", answer: { files: { "src/a.ts": "bad\n" } } }],
      env: ENV,
    };
    const out: VerifyOutcome = await verifyCard(input);
    expect(out.results.length).toBe(1);
    expect(out.results[0].exit).toBe(3);
    expect(out.results[0].log).toBe("out\n");
    expect(out.results[0].diff).toBe(
      "--- a/src/a.ts\n+++ b/src/a.ts\n@@ -1,1 +1,1 @@\n-old\n+bad\n",
    );
    expect(r.read("src/a.ts")).toBe("old\n");
  } finally {
    r.rm();
  }
});

test("a variant whose command times out is rejected with exit null and the tree rolled back", async () => {
  const r = freshRoot();
  try {
    const input: VerifyInput = {
      root: r.root,
      targets: ["src/a.ts"],
      command: "sleep 5",
      variants: [{ variant: "c.v1", answer: { files: { "src/a.ts": "good\n" } } }],
      env: ENV,
      timeoutMs: 200,
    };
    const out: VerifyOutcome = await verifyCard(input);
    expect(JSON.stringify(out.accepted)).toBe(JSON.stringify(null));
    expect(out.results.length).toBe(1);
    expect(out.results[0].exit).toBeNull();
    expect(out.results[0].log).toBe("acceptance timed out after 200 ms\n");
    expect(out.results[0].diff).toBe(
      "--- a/src/a.ts\n+++ b/src/a.ts\n@@ -1,1 +1,1 @@\n-old\n+good\n",
    );
    expect(r.read("src/a.ts")).toBe("old\n");
  } finally {
    r.rm();
  }
});

import { test, expect } from "vitest";
import { fileURLToPath } from "node:url";
import path from "node:path";
import { tmpRoot } from "../helpers.js";
import { loadDeck } from "../../src/cards/model.js";
import { weighSlices } from "../../src/cards/weigh.js";

const repoRoot = path.resolve(path.dirname(fileURLToPath(import.meta.url)), "../..");

test("Weigh Slices example 1", () => {
  const r = tmpRoot();
  try {
    r.write("big.txt", "x".repeat(600001));
    const result = loadDeck(
      JSON.stringify([
        { customId: "a", intent: "generate", targets: ["big.txt"], instruction: "x" },
      ]),
    );
    expect(result.ok).toBe(true);
    if (!result.ok) return;
    const weighing = weighSlices(result.deck, r.root);
    expect(weighing.hazards.length).toBe(1);
    expect(weighing.hazards[0]!.kind).toBe("oversized-slice");
    expect(weighing.hazards[0]!.severity).toBe("warning");
    expect(weighing.hazards[0]!.bytes).toBe(600001);
    expect(weighing.hazards[0]!.cap).toBe(500000);
  } finally {
    r.rm();
  }
});

test("Weigh Slices example 2 (fixture, default cap)", () => {
  const text = JSON.stringify(
    JSON.parse(
      JSON.stringify([
        {
          customId: "a",
          intent: "generate",
          targets: ["tests/fixtures/weigh/missing.txt"],
          contextSlice: [
            "tests/fixtures/weigh/ten.txt",
            "tests/fixtures/weigh/hundred.txt",
          ],
          instruction: "x",
        },
      ]),
    ),
  );
  const result = loadDeck(text);
  expect(result.ok).toBe(true);
  if (!result.ok) return;
  const weighing = weighSlices(result.deck, repoRoot);
  expect(weighing.weights.length).toBe(1);
  expect(weighing.weights[0]!.card).toBe("a");
  expect(weighing.weights[0]!.bytes).toBe(110);
  expect(JSON.stringify(weighing.weights[0]!.missing)).toBe(
    JSON.stringify(["tests/fixtures/weigh/missing.txt"]),
  );
  expect(weighing.hazards.length).toBe(0);
});

test("Weigh Slices example 3 (fixture, cap 100)", () => {
  const text = JSON.stringify([
    {
      customId: "a",
      intent: "generate",
      targets: ["tests/fixtures/weigh/missing.txt"],
      contextSlice: [
        "tests/fixtures/weigh/ten.txt",
        "tests/fixtures/weigh/hundred.txt",
      ],
      instruction: "x",
    },
  ]);
  const result = loadDeck(text);
  expect(result.ok).toBe(true);
  if (!result.ok) return;
  const weighing = weighSlices(result.deck, repoRoot, 100);
  expect(weighing.hazards.length).toBe(1);
  expect(weighing.hazards[0]!.kind).toBe("oversized-slice");
  expect(weighing.hazards[0]!.severity).toBe("warning");
  expect(weighing.hazards[0]!.bytes).toBe(110);
  expect(weighing.hazards[0]!.cap).toBe(100);
});

test("Weigh Slices: empty deck gives empty weights and hazards", () => {
  const result = loadDeck("[]");
  expect(result.ok).toBe(true);
  if (!result.ok) return;
  const weighing = weighSlices(result.deck, repoRoot);
  expect(weighing.weights.length).toBe(0);
  expect(weighing.hazards.length).toBe(0);
});

test("Weigh Slices: bytes exactly at cap is no hazard", () => {
  const r = tmpRoot();
  try {
    r.write("exact.txt", "x".repeat(500000));
    const result = loadDeck(
      JSON.stringify([
        { customId: "a", intent: "generate", targets: ["exact.txt"], instruction: "x" },
      ]),
    );
    expect(result.ok).toBe(true);
    if (!result.ok) return;
    const weighing = weighSlices(result.deck, r.root);
    expect(weighing.weights[0]!.bytes).toBe(500000);
    expect(weighing.hazards.length).toBe(0);
  } finally {
    r.rm();
  }
});

test("Weigh Slices: missing file counts 0 and is listed, others still counted", () => {
  const r = tmpRoot();
  try {
    r.write("a.txt", "12345");
    const result = loadDeck(
      JSON.stringify([
        {
          customId: "a",
          intent: "generate",
          targets: ["a.txt", "nope.txt"],
          instruction: "x",
        },
      ]),
    );
    expect(result.ok).toBe(true);
    if (!result.ok) return;
    const weighing = weighSlices(result.deck, r.root);
    expect(weighing.weights[0]!.bytes).toBe(5);
    expect(JSON.stringify(weighing.weights[0]!.missing)).toBe(
      JSON.stringify(["nope.txt"]),
    );
    expect(weighing.hazards.length).toBe(0);
  } finally {
    r.rm();
  }
});

test("Weigh Slices: a directory in the slice counts 0 and is missing", () => {
  const r = tmpRoot();
  try {
    r.write("dir/inner.txt", "hello");
    const result = loadDeck(
      JSON.stringify([
        { customId: "a", intent: "generate", targets: ["dir"], instruction: "x" },
      ]),
    );
    expect(result.ok).toBe(true);
    if (!result.ok) return;
    const weighing = weighSlices(result.deck, r.root);
    expect(weighing.weights[0]!.bytes).toBe(0);
    expect(JSON.stringify(weighing.weights[0]!.missing)).toBe(
      JSON.stringify(["dir"]),
    );
  } finally {
    r.rm();
  }
});

test("Weigh Slices: duplicate path between contextSlice and targets counted once", () => {
  const r = tmpRoot();
  try {
    r.write("same.txt", "0123456789");
    const result = loadDeck(
      JSON.stringify([
        {
          customId: "a",
          intent: "generate",
          targets: ["same.txt"],
          contextSlice: ["same.txt"],
          instruction: "x",
        },
      ]),
    );
    expect(result.ok).toBe(true);
    if (!result.ok) return;
    const weighing = weighSlices(result.deck, r.root);
    expect(weighing.weights[0]!.bytes).toBe(10);
    expect(weighing.weights[0]!.missing.length).toBe(0);
  } finally {
    r.rm();
  }
});

test("Weigh Slices: one hazard per card over cap, in deck order", () => {
  const r = tmpRoot();
  try {
    r.write("big1.txt", "x".repeat(600));
    r.write("small.txt", "y");
    r.write("big2.txt", "z".repeat(700));
    const result = loadDeck(
      JSON.stringify([
        { customId: "a", intent: "generate", targets: ["big1.txt"], instruction: "x" },
        { customId: "b", intent: "generate", targets: ["small.txt"], instruction: "x" },
        { customId: "c", intent: "generate", targets: ["big2.txt"], instruction: "x" },
      ]),
    );
    expect(result.ok).toBe(true);
    if (!result.ok) return;
    const weighing = weighSlices(result.deck, r.root, 500);
    expect(weighing.hazards.length).toBe(2);
    expect(JSON.stringify(weighing.hazards.map((h) => h.cards))).toBe(
      JSON.stringify([["a"], ["c"]]),
    );
    expect(weighing.hazards[0]!.bytes).toBe(600);
    expect(weighing.hazards[1]!.bytes).toBe(700);
    expect(weighing.hazards[0]!.cap).toBe(500);
  } finally {
    r.rm();
  }
});

test("Weigh Slices: card with no slice and no target weight is impossible; empty targets alone weigh 0", () => {
  const r = tmpRoot();
  try {
    const result = loadDeck(
      JSON.stringify([
        { customId: "a", intent: "generate", targets: ["t.txt"], instruction: "x" },
      ]),
    );
    expect(result.ok).toBe(true);
    if (!result.ok) return;
    const weighing = weighSlices(result.deck, r.root);
    expect(weighing.weights[0]!.bytes).toBe(0);
    expect(JSON.stringify(weighing.weights[0]!.missing)).toBe(
      JSON.stringify(["t.txt"]),
    );
    expect(weighing.hazards.length).toBe(0);
  } finally {
    r.rm();
  }
});

test("Weigh Slices: oversized hazard cards and path fields", () => {
  const r = tmpRoot();
  try {
    r.write("huge.txt", "q".repeat(600001));
    const result = loadDeck(
      JSON.stringify([
        { customId: "only", intent: "generate", targets: ["huge.txt"], instruction: "x" },
      ]),
    );
    expect(result.ok).toBe(true);
    if (!result.ok) return;
    const weighing = weighSlices(result.deck, r.root);
    expect(weighing.hazards.length).toBe(1);
    const h = weighing.hazards[0]!;
    expect(h.cards[0]).toBe("only");
    expect(h.cards.length).toBe(1);
    expect(h.path).toBe(null);
    expect(h.repair).toBe(null);
  } finally {
    r.rm();
  }
});

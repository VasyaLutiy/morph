import { expect, test } from "vitest";
import type { StoryTexts } from "../../src/primer/readStory.js";
import { readStory } from "../../src/primer/readStory.js";
import { fixture, fixtureJson } from "../helpers.js";

const EMPTY: StoryTexts = {
  measure: null,
  plan: null,
  autonomy: null,
  decisions: null,
  issues: null,
};

test("Read Story example 1", () => {
  const texts: StoryTexts = {
    measure: fixture("primer/story/measure.md"),
    plan: fixture("primer/story/plan.md"),
    autonomy: fixture("primer/story/autonomy.md"),
    decisions: fixture("primer/story/decisions.md"),
    issues: fixture("primer/story/issues.json"),
  };
  const runs = fixtureJson("primer/story/runs.json") as { runId: string; models: string[] }[];
  const expected = (fixtureJson("primer/story.json") as Record<string, unknown>)["Read Story 1"];
  expect(readStory(texts, runs)).toStrictEqual(expected);
});

test("Read Story example 2", () => {
  const measure = [
    "intro",
    "| $ исп. | прогоны | фаза | x | **строитель** | карт план/принято |",
    "|---|---|:---:|---|---|---|",
    "| 0.5 / — | 20261101-090000 20261101-100000-0123abcd | P1 | a\\|b | **night** (old) | 3 / 2 (two runs) |",
    "| — | | P1 smoke | | night | n/a |",
    "| 1.25 | 20261102-080000 | **P2** | | day | 4/4 |",
    "",
    "| фаза | строитель |",
    "|---|---|",
    "| P9 | late |",
    "",
  ].join("\n");
  const runs = [
    { runId: "20261101-100000-0123abcd", models: ["m/b"] },
    { runId: "20261101-090000", models: ["m/a", "m/b"] },
    { runId: "20261102-080000", models: ["m/c"] },
  ];
  const expected = (fixtureJson("primer/story.json") as Record<string, unknown>)["Read Story 2"];
  expect(readStory({ ...EMPTY, measure }, runs)).toStrictEqual(expected);
});

test("Read Story example 3", () => {
  const plan =
    "| фаза | C | what |\n|---|---|---|\n| P1 | a | x |\n| P10a | b | y |\n| P11b | c | z |\n| P12 | d | w |\n";
  const measureA = "| фаза |\n|---|\n| P10a |\n| P11b1 |\n| P12 smoke |\n";
  const measureB = "| фаза |\n|---|\n| P1 |\n| P10a |\n| P11b1 |\n";
  const measureC = "| фаза |\n|---|\n| P1 |\n| P10a |\n| P11b1 |\n| P12a |\n";
  const autonomyA =
    "## State at handoff (x)\n\nline 1\nline 2\nNext: P12\nline 4\nline 5\nline 6\n## Machine\n";
  const autonomyB = "## State at handoff\na\n\nb\n";
  const handoffA = ["State at handoff (x)", "Next: P12", "line 4", "line 5", "line 6"];

  expect(readStory({ ...EMPTY, plan, measure: measureA, autonomy: autonomyA }, []).next).toStrictEqual({
    phase: "P1",
    row: "P1 · a · x",
    handoff: handoffA,
  });
  expect(readStory({ ...EMPTY, plan, measure: measureB, autonomy: autonomyA }, []).next).toStrictEqual({
    phase: "P12",
    row: "P12 · d · w",
    handoff: handoffA,
  });
  expect(readStory({ ...EMPTY, plan, measure: measureC, autonomy: autonomyA }, []).next).toStrictEqual({
    phase: null,
    row: null,
    handoff: handoffA,
  });
  expect(
    readStory({ ...EMPTY, plan, measure: measureA, autonomy: autonomyB }, []).next.handoff,
  ).toStrictEqual(["State at handoff", "a", "b"]);
});

test("Read Story example 4", () => {
  const decisions = "# D\n\n- a\n b \n\n- c\nd\n- e\nf\n" + "- " + "g".repeat(310) + "\n";
  const issues = "{";
  const list =
    "[{\"number\": 3, \"title\": \"t\", \"labels\": [\"x\", {\"name\": \"y\"}, 5]}, {\"number\": \"4\", \"title\": \"bad\"}, {\"number\": 5, \"title\": \"u\"}]";

  const first = readStory({ ...EMPTY, decisions, issues }, []);
  expect(first.decisions).toStrictEqual(["c", "d", "e", "f", "g".repeat(299) + "…"]);
  expect(first.issues).toStrictEqual({ state: "unreadable", items: [] });

  const second = readStory({ ...EMPTY, decisions, issues: list }, []);
  expect(second.issues).toStrictEqual({
    state: "read",
    items: [
      { number: 3, title: "t", labels: ["x", "y"] },
      { number: 5, title: "u", labels: [] },
    ],
  });
});

test("Read Story example 5", () => {
  expect(readStory(EMPTY, [])).toStrictEqual({
    chronology: [],
    next: { phase: null, row: null, handoff: [] },
    decisions: [],
    issues: { state: "absent", items: [] },
    missing: ["measure", "plan", "autonomy", "decisions"],
  });
});

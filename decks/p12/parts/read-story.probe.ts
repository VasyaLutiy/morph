// P12a probe for read-story by docs/TASK_P12_primer.md §2.2 (Read Story) — the chronology from the first "фаза" table of
// MEASURE joined to the runs by id, switch points between main phases, the next open row of the LAST plan table, the
// handoff window from the line holding Next, the last five decisions, issues from a file. Record Read Story examples 1-5,
// then the §2.2 rows.
import { test, expect } from "vitest";
import { readStory } from "../../src/primer/readStory.js";
import type { Story, StoryTexts } from "../../src/primer/readStory.js";
import { fixture, fixtureJson } from "../../tests/helpers.js";

const want = (k: string): unknown => (fixtureJson("primer/story.json") as Record<string, unknown>)[k];
const NONE: StoryTexts = { measure: null, plan: null, autonomy: null, decisions: null, issues: null };

test("Read Story example 1: the real excerpts give the project's story", () => {
  const texts: StoryTexts = { measure: fixture("primer/story/measure.md"), plan: fixture("primer/story/plan.md"),
    autonomy: fixture("primer/story/autonomy.md"), decisions: fixture("primer/story/decisions.md"), issues: fixture("primer/story/issues.json") };
  const got = readStory(texts, fixtureJson("primer/story/runs.json") as { runId: string; models: string[] }[]);
  expect(got.chronology.filter((l) => l.switches.length).map((l) => l.phase).join(","), "switch rows").toBe("P10a,P10b1,P11b1");
  expect(got.next.phase, "next").toBe("P12a");
  expect(got, "story.json Read Story 1").toStrictEqual(want("Read Story 1"));
});

test("Read Story example 2: columns by name in any order, an escaped pipe, the first table only", () => {
  const measure = "intro\n| $ исп. | прогоны | фаза | x | **строитель** | карт план/принято |\n|---|---|:---:|---|---|---|\n" +
    "| 0.5 / — | 20261101-090000 20261101-100000-0123abcd | P1 | a\\|b | **night** (old) | 3 / 2 (two runs) |\n" +
    "| — | | P1 smoke | | night | n/a |\n| 1.25 | 20261102-080000 | **P2** | | day | 4/4 |\n\n| фаза | строитель |\n|---|---|\n| P9 | late |\n";
  const runs = [{ runId: "20261101-100000-0123abcd", models: ["m/b"] }, { runId: "20261101-090000", models: ["m/a", "m/b"] },
    { runId: "20261102-080000", models: ["m/c"] }];
  const got = readStory({ ...NONE, measure }, runs);
  expect(got.chronology[2].switches, "P2 switches").toStrictEqual(["builder night → day", "model m/a, m/b → m/c"]);
  expect(got, "story.json Read Story 2").toStrictEqual(want("Read Story 2"));
});

test("Read Story example 3: the next open row and the handoff window", () => {
  const plan = "| фаза | C | what |\n|---|---|---|\n| P1 | a | x |\n| P10a | b | y |\n| P11b | c | z |\n| P12 | d | w |\n";
  const m = (rows: string[]): string => "| фаза |\n|---|\n" + rows.map((r) => `| ${r} |\n`).join("");
  const autonomy = "## State at handoff (x)\n\nline 1\nline 2\nNext: P12\nline 4\nline 5\nline 6\n## Machine\n";
  const a = readStory({ ...NONE, plan, measure: m(["P10a", "P11b1", "P12 smoke"]), autonomy }, []);
  expect(a.next, "P1 open").toStrictEqual({ phase: "P1", row: "P1 · a · x", handoff: ["State at handoff (x)", "Next: P12", "line 4", "line 5", "line 6"] });
  const b = readStory({ ...NONE, plan, measure: m(["P1", "P10a", "P11b1"]), autonomy: "## State at handoff\na\n\nb\n" }, []);
  expect(b.next, "P12 open").toStrictEqual({ phase: "P12", row: "P12 · d · w", handoff: ["State at handoff", "a", "b"] });
  const c = readStory({ ...NONE, plan, measure: m(["P1", "P10a", "P11b1", "P12a"]) }, []);
  expect(c.next, "none open").toStrictEqual({ phase: null, row: null, handoff: [] });
});

test("Read Story example 4: the last five decisions, issues unreadable then read", () => {
  const decisions = "# D\n\n- a\n  b  \n\n- c\nd\n- e\nf\n" + "- " + "g".repeat(310) + "\n";
  const a = readStory({ ...NONE, decisions, issues: "{" }, []);
  expect(a.decisions, "decisions").toStrictEqual(["c", "d", "e", "f", "g".repeat(299) + "…"]);
  expect(a.issues, "unreadable").toStrictEqual({ state: "unreadable", items: [] });
  const b = readStory({ ...NONE, issues: '[{"number": 3, "title": "t", "labels": ["x", {"name": "y"}, 5]}, {"number": "4", "title": "bad"}, {"number": 5, "title": "u"}]' }, []);
  expect(b.issues, "read").toStrictEqual({ state: "read", items: [{ number: 3, title: "t", labels: ["x", "y"] }, { number: 5, title: "u", labels: [] }] });
});

test("Read Story example 5: every text null", () => {
  const want5: Story = { chronology: [], next: { phase: null, row: null, handoff: [] }, decisions: [], issues: { state: "absent", items: [] },
    missing: ["measure", "plan", "autonomy", "decisions"] };
  expect(readStory(NONE, []), "empty").toStrictEqual(want5);
});

test("§2.2 rows: notes cut at 100, a row without numbers, a missing column, side rows do not move the comparison", () => {
  const long = "n".repeat(120);
  const measure = "| фаза | строитель | карт | $ |\n|---|---|---|---|\n" +
    `| P3 | a (x) | 1 / 1 (${long}) | 0.1 |\n| P3 smoke | zz | 2 / 2 (open | $ 7 |\n| P4 | a | — | x |\n| P5 | b ( | 5/5 | 3 |\n`;
  const got = readStory({ ...NONE, measure, plan: "| x | фаза |\n|---|---|\n| q | P3 |\n| r | P9 |\n" }, []);
  expect(got.chronology.map((l) => l.notes), "notes").toStrictEqual(["n".repeat(99) + "…", "open", "", ""]);
  expect(got.chronology.map((l) => `${l.builder}|${l.cost}|${l.planned}|${l.written}|${l.runs}|${l.date}`), "cells").toStrictEqual(
    ["a|0.1|1|1|0|", "zz|7|2|2|0|", "a||null|null|0|", "b|3|5|5|0|"]);
  expect(got.chronology.map((l) => l.switches.join(";")), "switches").toStrictEqual(["", "", "", "builder a → b"]);
  expect(got.next, "the phase column, first three cells").toStrictEqual({ phase: "P9", row: "r · P9", handoff: [] });
});

test("§2.2 rows: a model switch only against the last non-empty models, the first run with an id, cuts of row and handoff", () => {
  const measure = "| фаза | строитель | прогоны |\n|---|---|---|\n| P1 | b | 20260101-000000 |\n| P2 | b | |\n| P3 | b | 20260102-000000 20260101-000000 |\n| P4 | b | 20260103-000000 |\n";
  const runs = [{ runId: "20260101-000000", models: ["k"] }, { runId: "20260102-000000", models: ["k", "j"] }, { runId: "20260101-000000", models: ["zzz"] },
    { runId: "20260103-000000", models: ["j", "k"] }];
  const got = readStory({ ...NONE, measure, plan: "| фаза | a | b |\n|---|---|---|\n| P9 | " + "w".repeat(300) + " | c |\n",
    autonomy: "## State at handoff\n" + "h".repeat(250) + "\n" }, runs);
  expect(got.chronology.map((l) => `${l.models.join(",")}/${l.switches.join(";")}`), "models and switches").toStrictEqual(
    ["k/", "/", "k,j/model k → k, j", "j,k/model k, j → j, k"]);
  expect(`${got.next.row?.length}|${got.next.row?.endsWith("…")}|${got.next.handoff[1].length}`, "cuts").toBe("300|true|200");
  expect(got.chronology[2].date, "the first id's date").toBe("2026-01-02");
});

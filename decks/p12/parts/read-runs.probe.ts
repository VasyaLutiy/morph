// P12a probe for read-runs by docs/TASK_P12_primer.md §2.2 (Read Runs) — both archived report forms (V2 runId + array
// outcomes, mrph deck_id + object outcomes) read tolerantly, broken ones skipped with their reason, totals over both with
// a per-form split, nothing thrown, generations never read. Record Read Runs examples 1-3, then the §2.2 rows.
import { test, expect } from "vitest";
import { readRuns } from "../../src/primer/readRuns.js";
import type { RunArchive, RunsDigest } from "../../src/primer/readRuns.js";
import { fixture, fixtureJson } from "../../tests/helpers.js";

const rep = (d: string): string => fixture("primer/runs/" + d + "/report.json");
const want = (k: string): unknown => (fixtureJson("primer/runs.json") as Record<string, unknown>)[k];

test("Read Runs example 1: four real archives, two forms, totals over both", () => {
  const got = readRuns([
    { dir: "20261007-204822", report: rep("20261007-204822"), answers: 15 },
    { dir: "20261007-092723-3c3f1c83", report: rep("20261007-092723-3c3f1c83"), answers: 0 },
    { dir: "20261007-111944", report: rep("20261007-111944"), answers: 0 },
    { dir: "20261006-135524-8c114477", report: rep("20261006-135524-8c114477"), answers: 0 },
  ]);
  expect(got.runs.map((r) => `${r.runId}:${r.format}`).join(" "), "order and forms").toBe(
    "20261006-135524-8c114477:mrph 20261007-092723-3c3f1c83:mrph 20261007-111944:v2 20261007-204822:v2");
  expect(`${got.totals.cards}|${got.totals.written}|${got.totals.requests}|${got.totals.answers}`, "totals").toBe("20|12|32|15");
  expect(got, "runs.json Read Runs 1").toStrictEqual(want("Read Runs 1"));
});

test("Read Runs example 2: broken and foreign reports skipped, a V2 report without totals", () => {
  const got = readRuns([
    { dir: "x", report: null, answers: 0 },
    { dir: "y", report: "{", answers: 0 },
    { dir: "z", report: "[]", answers: 0 },
    { dir: "w", report: '{"runId": 5, "outcomes": []}', answers: 0 },
    { dir: "e2e", report: '{"runId": "e2e", "outcomes": [{"status": "budget-exceeded"}, 7]}', answers: 2 },
    { dir: "20261108-010203", report: '{"runId": "20261108-010203", "processor": "night", "outcomes": [{"status": "written"}, {"status": "failed"}], "requests": [{"model": "x/y"}, {"model": "a/b"}, {"model": "x/y"}, "q"]}', answers: 3 },
  ]);
  expect(got.skipped, "skipped").toStrictEqual([
    { dir: "w", reason: "unknown report format" }, { dir: "x", reason: "no report.json" },
    { dir: "y", reason: "report.json is not a JSON object" }, { dir: "z", reason: "report.json is not a JSON object" }]);
  expect(got, "runs.json Read Runs 2").toStrictEqual(want("Read Runs 2"));
});

test("Read Runs example 3: a batch-route V2 report with cost null beside an mrph report", () => {
  const got = readRuns([
    { dir: "20261007-155108", report: rep("20261007-155108"), answers: 0 },
    { dir: "20261006-135524-8c114477", report: rep("20261006-135524-8c114477"), answers: 0 },
  ]);
  expect(`${got.totals.unpriced}|${got.totals.models.map((m) => m.model).join(",")}`, "unpriced, models").toBe("1|z-ai/glm-5.3,z-ai/glm-5.3:batch");
  expect(got, "runs.json Read Runs 3").toStrictEqual(want("Read Runs 3"));
});

test("§2.2 rows: mrph without usage_totals, a non-finite cost, models counted per run, the input not sorted in place", () => {
  const mrph = JSON.stringify({ deck_id: "20261201-000000-abcdef01", backend_label: 7, generations: [["a"]],
    outcomes: { a: { status: "written" }, b: { status: "skipped" }, c: null }, usage: { "a.v1": { model: "q/r" }, "a.v2": { model: "q/r" }, "b.v1": { model: "p/s" } } });
  const v2 = JSON.stringify({ runId: "20261202-010101", processor: "zz", generations: 3, outcomes: [{ status: "failed" }],
    usageTotals: { requests: 9, cost: "0.5" }, requests: [{ model: "q/r" }] });
  const input: RunArchive[] = [{ dir: "b", report: v2, answers: 1 }, { dir: "a", report: mrph, answers: 0 }];
  const got: RunsDigest = readRuns(input);
  expect(input.map((a) => a.dir).join(","), "input untouched").toBe("b,a");
  expect(got.runs[0], "mrph").toStrictEqual({ runId: "20261201-000000-abcdef01", format: "mrph", date: "2026-12-01", processor: "",
    models: ["p/s", "q/r"], cards: 3, written: 1, failed: 0, skipped: 1, requests: 3, cost: null, answers: 0 });
  expect(got.runs[1], "v2").toStrictEqual({ runId: "20261202-010101", format: "v2", date: "2026-12-02", processor: "zz",
    models: ["q/r"], cards: 1, written: 0, failed: 1, skipped: 0, requests: 9, cost: null, answers: 1 });
  expect(got.totals.models, "models by runs").toStrictEqual([{ model: "p/s", runs: 1 }, { model: "q/r", runs: 2 }]);
  expect(`${got.totals.from}|${got.totals.to}|${got.totals.unpriced}|${got.totals.cost}`, "from to").toBe("2026-12-01|2026-12-02|2|0");
});

test("§2.2 rows: the cost sums in run order, per form and over both", () => {
  const r = (id: string, cost: number | null): string => JSON.stringify({ runId: id, outcomes: [], usageTotals: { requests: 1, cost } });
  const m = (id: string, cost: number): string => JSON.stringify({ deck_id: id, outcomes: {}, usage_totals: { requests: 2, cost } });
  const got = readRuns([{ dir: "3", report: r("c", 0.2), answers: 0 }, { dir: "1", report: m("a", 0.1), answers: 0 },
    { dir: "2", report: r("b", null), answers: 0 }, { dir: "4", report: m("d", 0.7), answers: 0 }]);
  expect(got.totals.cost, "0.1 + 0.2 + 0.7 in run order").toBe(0.1 + 0.2 + 0.7);
  expect(got.totals.v2, "v2").toStrictEqual({ runs: 2, cards: 0, written: 0, cost: 0 + 0 + 0.2 });
  expect(got.totals.mrph, "mrph").toStrictEqual({ runs: 2, cards: 0, written: 0, cost: 0.1 + 0.7 });
  expect(`${got.totals.requests}|${got.totals.unpriced}|${got.totals.from}|${got.totals.to}`, "requests").toBe("6|1||");
});

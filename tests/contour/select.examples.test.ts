import { test, expect } from "vitest";
import { fixtureJson } from "../helpers.js";
import { validateRecord } from "../../src/contour/record.js";
import { selectComponents, functionLinks } from "../../src/contour/select.js";
import type { ContourRecord, Component } from "../../src/contour/types.js";

function typed(name: string): ContourRecord {
  const r = validateRecord(fixtureJson(name));
  if (!r.ok) throw new Error(r.problems.join("\n"));
  return r.record;
}
const MINI = typed("contour/mini.json");
const TALLY = MINI.system.groups[0] as Component;
const STORE = MINI.system.groups[1] as Component;

test("Select Components example 1: no names on a multi-Component record, then a one-Component record", () => {
  const multi = selectComponents(MINI, []);
  expect(multi).toStrictEqual({
    ok: false,
    error: "the record has 2 Components (tally, store): pass --component",
  });
  const one: ContourRecord = { ...MINI, system: { ...MINI.system, groups: [TALLY] } };
  const single = selectComponents(one, []);
  expect(single).toStrictEqual({ ok: true, components: [TALLY] });
  expect(single.ok ? single.components[0] : null).toBe(TALLY);
});

test("Select Components example 2: slug matching, given order, a repeat listed once", () => {
  const r = selectComponents(MINI, ["Store", "tally", "store"]);
  expect(r).toStrictEqual({ ok: true, components: [STORE, TALLY] });
  expect(r.ok ? r.components[0] : null).toBe(STORE);
  expect(r.ok ? r.components[1] : null).toBe(TALLY);
});

test("Select Components example 3: an unmatched name stops the walk", () => {
  const r = selectComponents(MINI, ["tally", "nope"]);
  expect(r).toStrictEqual({
    ok: false,
    error: "no Component 'nope' in the record (have: tally, store)",
  });
});

test("Function Links example 1: tally — a repeated call listed once, a non-Data-Object ignored", () => {
  const r = functionLinks(MINI, TALLY);
  expect(r).toStrictEqual({
    ok: true,
    links: [
      { function: "Count Words", calls: [], dataObjects: [], uses: [] },
      { function: "Report Count", calls: ["Count Words"], dataObjects: ["Text File"], uses: ["node:fs"] },
    ],
  });
});

test("Function Links example 2: store — a Data Object of another Component counts", () => {
  const r = functionLinks(MINI, STORE);
  expect(r).toStrictEqual({
    ok: true,
    links: [
      { function: "Save Count", calls: [], dataObjects: ["Count Record"], uses: ["tally"] },
      { function: "Load Counts", calls: [], dataObjects: ["Count Record", "Text File"], uses: [] },
    ],
  });
});

test("Function Links example 3: badCalls — an unknown callee and a self-call", () => {
  const LOOP = typed("contour/badCalls.json").system.groups[0] as Component;
  const r = functionLinks(typed("contour/badCalls.json"), LOOP);
  expect(r).toStrictEqual({
    ok: false,
    errors: [
      "Function 'A' calls unknown Function 'B' of Component 'loop'",
      "Function 'C' calls itself",
    ],
  });
});

test("selectComponents returns the record's own Component objects", () => {
  const r = selectComponents(MINI, ["store"]);
  expect(r.ok ? r.components[0] : null).toBe(STORE);
});

test("selectComponents: 0 Components and no names gives the count error", () => {
  const empty: ContourRecord = { ...MINI, system: { ...MINI.system, groups: [] } };
  expect(selectComponents(empty, [])).toStrictEqual({
    ok: false,
    error: "the record has 0 Components (): pass --component",
  });
});

test("selectComponents: the first unmatched name stops the walk even when a later one matches", () => {
  const r = selectComponents(MINI, ["nope", "tally"]);
  expect(r).toStrictEqual({
    ok: false,
    error: "no Component 'nope' in the record (have: tally, store)",
  });
});

test("functionLinks: an unknown callee is not added to calls", () => {
  const BAD = typed("contour/badCalls.json");
  const LOOP = BAD.system.groups[0] as Component;
  const r = functionLinks(BAD, LOOP);
  if (!r.ok) {
    expect(r.errors.length).toBe(2);
  } else {
    expect.unreachable("badCalls must fail");
  }
});

test("functionLinks: empty Component gives ok with no links", () => {
  const none: Component = { ...TALLY, functions: [] };
  expect(functionLinks(MINI, none)).toStrictEqual({ ok: true, links: [] });
});

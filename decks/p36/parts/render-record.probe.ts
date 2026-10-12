// P36 probe for render-record (src/primerRecord/renderRecord.ts): the record's Render Record examples 1-4.
import { expect, test } from "vitest";
import { RECORD_CAP, WEIGHT_RULE, renderRecord } from "../../src/primerRecord/renderRecord.js";
import type { RecordSection } from "../../src/primerRecord/renderRecord.js";
import { fixture, fixtureJson } from "../../tests/helpers.js";

const EX = fixtureJson("primerRecord/examples.json") as Record<string, { given: unknown; then: unknown }>;

test("Render Record example 1: the fixture project's section is exactly section1.md", () => {
  expect(renderRecord(EX["Render Record 1"].given as RecordSection)).toBe(fixture("primerRecord/section1.md"));
});

test("Render Record example 2: caps of 10 named, 30000 not over, layers not checked", () => {
  expect(RECORD_CAP).toBe(10);
  expect(WEIGHT_RULE).toBe(30000);
  expect(renderRecord(EX["Render Record 2"].given as RecordSection)).toBe(EX["Render Record 2"].then as string);
});

test("Render Record example 3: not read is one line", () => {
  expect(renderRecord({ state: "not read", reason: "no contour.yaml" }))
    .toBe("\n## Record vs code\n\n- record: not read: no contour.yaml\n");
});

test("Render Record example 4: singular counts, no weights, no layer gap", () => {
  expect(renderRecord(EX["Render Record 4"].given as RecordSection)).toBe(EX["Render Record 4"].then as string);
});

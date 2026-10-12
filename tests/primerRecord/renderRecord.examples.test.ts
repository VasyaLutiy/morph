import { expect, test } from "vitest";
import { fixture, fixtureJson, fixturePath, tmpRoot } from "../helpers.js";
import type { RecordSection } from "../../src/primerRecord/renderRecord.js";
import { renderRecord } from "../../src/primerRecord/renderRecord.js";

const EX = fixtureJson("primerRecord/examples.json") as Record<
  string,
  { given: unknown; then: unknown }
>;

void fixturePath;
void tmpRoot;

test("Render Record example 1: read record with one layer gap", () => {
  const given = EX["Render Record 1"].given as RecordSection;
  expect(renderRecord(given)).toBe(fixture("primerRecord/section1.md"));
});

test("Render Record example 2: caps lists and weights", () => {
  const given = EX["Render Record 2"].given as RecordSection;
  const expected = EX["Render Record 2"].then as string;
  expect(renderRecord(given)).toBe(expected);
});

test("Render Record example 3: not read", () => {
  expect(renderRecord({ state: "not read", reason: "no contour.yaml" })).toBe(
    "\n## Record vs code\n\n- record: not read: no contour.yaml\n",
  );
});

test("Render Record example 4: minimal read", () => {
  const given = EX["Render Record 4"].given as RecordSection;
  const expected = EX["Render Record 4"].then as string;
  expect(renderRecord(given)).toBe(expected);
});

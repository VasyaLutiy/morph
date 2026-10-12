// P36 probe for record-section (src/primerRecord/recordSection.ts): the record's Record Section examples 1-4.
import { cpSync, rmSync, writeFileSync } from "node:fs";
import { expect, test } from "vitest";
import { GO, PYTHON, TYPESCRIPT } from "../../src/language/profiles.js";
import { recordSection } from "../../src/primerRecord/recordSection.js";
import { fixture, fixtureJson, fixturePath, tmpRoot } from "../../tests/helpers.js";

const EX = fixtureJson("primerRecord/examples.json") as Record<string, { given: unknown; then: unknown }>;
const REPO = fixturePath("primerRecord/repo");
const E1 = EX["Record Section 1"].given as { files: string[]; owned: string[] };

test("Record Section example 1: the fixture project is exactly section1.md", () => {
  expect(recordSection(REPO, E1.files, TYPESCRIPT, E1.owned)).toBe(fixture("primerRecord/section1.md"));
});

test("Record Section example 2: no record, no map, a record not a mapping, a map not valid", () => {
  const then = EX["Record Section 2"].then as string[];
  const cases: Record<string, string>[] = [
    {},
    { "contour.yaml": fixture("primerRecord/repo/contour.yaml") },
    { "contour.yaml": "- a\n", "morph-map.json": "{}" },
    { "contour.yaml": fixture("primerRecord/repo/contour.yaml"), "morph-map.json": "{\"cards\": 5}" },
  ];
  cases.forEach((files, i) => {
    const t = tmpRoot();
    try {
      for (const [rel, text] of Object.entries(files)) t.write(rel, text);
      expect(recordSection(t.root, [], TYPESCRIPT, [])).toBe(then[i]);
    } finally {
      t.rm();
    }
  });
});

test("Record Section example 3: guard contract 0 twice, then python has no import rule", () => {
  const then = EX["Record Section 3"].then as string[];
  const t = tmpRoot();
  try {
    cpSync(REPO, t.root, { recursive: true });
    writeFileSync(t.path("decks/tools/guard.mjs"), "// the old guard\n");
    expect(recordSection(t.root, E1.files, TYPESCRIPT, E1.owned)).toBe(then[0]);
    rmSync(t.path("decks/tools/guard.mjs"));
    expect(recordSection(t.root, E1.files, TYPESCRIPT, E1.owned)).toBe(then[1]);
  } finally {
    t.rm();
  }
  expect(recordSection(REPO, E1.files, PYTHON, E1.owned)).toBe(then[2]);
});

test("Record Section example 4: a Go project, b → a (b/get_b.go)", () => {
  const g = EX["Record Section 4"].given as { files: Record<string, string>; listed: string[]; owned: string[] };
  const t = tmpRoot();
  try {
    for (const [rel, text] of Object.entries(g.files)) t.write(rel, text);
    expect(recordSection(t.root, g.listed, GO, g.owned)).toBe(EX["Record Section 4"].then as string);
  } finally {
    t.rm();
  }
});

import { test, expect } from "vitest";
import { cardTsconfig, probeDir } from "../../src/builder/probeDir.js";
import { fixture } from "../helpers.js";

test("Probe Dir example 1: cardTsconfig without and with exclude", () => {
  expect(cardTsconfig([])).toBe(
    JSON.stringify(
      { extends: "../../tsconfig.json", include: ["../../src", "../../tests", "./*.probe.ts"] },
      null,
      2,
    ) + "\n",
  );
  expect(cardTsconfig(["src/b.ts"])).toBe(
    JSON.stringify(
      {
        extends: "../../tsconfig.json",
        include: ["../../src", "../../tests", "./*.probe.ts"],
        exclude: ["../../src/b.ts"],
      },
      null,
      2,
    ) + "\n",
  );
});

test("Probe Dir example 2: probeDir with a probe equals the fixture", () => {
  const out = probeDir("c", "// guard\n", "// firstdiff\n", "// probe\n", [
    "src/b.ts",
    "tests/b.examples.test.ts",
  ]);
  expect(out).toBe(fixture("builder/probeDir.txt"));
  expect(out).toContain('include: ["probe/c/**/*.probe.ts"]');
});

test("Probe Dir example 3: probeDir with probe null drops the last 3 lines", () => {
  const whole = fixture("builder/probeDir.txt");
  const lines = whole.split("\n");
  const kept = lines.slice(0, lines.length - 4).join("\n") + "\n";
  expect(probeDir("c", "// guard\n", "// firstdiff\n", null, [
    "src/b.ts",
    "tests/b.examples.test.ts",
  ])).toBe(kept);
});

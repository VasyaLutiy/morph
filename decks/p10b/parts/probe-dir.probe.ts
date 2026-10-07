// P10b probe for probe-dir: cardTsconfig, vitestConfig, probeDir by docs/TASK_P10b_builder.md §2.2, one test per
// record example (Component builder: Probe Dir 1-3), then the §2.2 rows and the types.
import { test, expect, expectTypeOf } from "vitest";
import { cardTsconfig, probeDir, vitestConfig } from "../../src/builder/probeDir.js";
import { fixture } from "../../tests/helpers.js";

// the heredoc tags are spelled in two pieces: build.py refuses a probe whose text holds one
const M = (t: string): string => "MORPH" + "_" + t + "_EOF";

const BASE = '{\n  "extends": "../../tsconfig.json",\n  "include": [\n    "../../src",\n    "../../tests",\n    "./*.probe.ts"\n  ]';

test("Probe Dir example 1: the per-card tsconfig, with and without siblings", () => {
  expect(cardTsconfig([])).toBe(BASE + "\n}\n");
  expect(cardTsconfig(["src/b.ts"])).toBe(BASE + ',\n  "exclude": [\n    "../../src/b.ts"\n  ]\n}\n');
});

test("Probe Dir example 2: the whole directory, probe included", () => {
  expect(probeDir("c", "// guard\n", "// firstdiff\n", "// probe\n", ["src/b.ts", "tests/b.examples.test.ts"]))
    .toBe(fixture("builder/probeDir.txt"));
});

test("Probe Dir example 3: no probe, no probe heredoc", () => {
  const whole = fixture("builder/probeDir.txt").split("\n");
  expect(probeDir("c", "// guard\n", "// firstdiff\n", null, ["src/b.ts", "tests/b.examples.test.ts"]))
    .toBe(whole.slice(0, whole.length - 4).join("\n") + "\n");
});

test("§2.2 vitestConfig: seven lines, the card's include", () => {
  const v = vitestConfig("render-judge");
  expect(v.split("\n")).toHaveLength(8);
  expect(v.endsWith("});\n")).toBe(true);
  expect(v).toContain('include: ["probe/render-judge/**/*.probe.ts"]');
  expect(v).toContain('setupFiles: ["tests/setup.ts"], chaiConfig: { truncateThreshold: 200 } },');
});

test("§2.2 the heredoc order and the texts trimmed", () => {
  const s = probeDir("k", "G  \n\n", "F", "T", []);
  expect(s.startsWith(("P=$PWD/probe/k; rm -rf $P; mkdir -p $P; trap 'rm -rf $P' EXIT\ncat > $P/guard.mjs <<'" + M("GUARD") + "'\nG\n" + M("GUARD") + "\n"))).toBe(true);
  const order = [M("GUARD"), M("CONF"), M("TSCONF"), M("FIRSTDIFF"), M("PROBE")].map((t) => s.indexOf("<<'" + t + "'"));
  expect(order.every((x, i) => x >= 0 && (i === 0 || x > order[i - 1]))).toBe(true);
  expect(s.endsWith(("cat > $P/k.probe.ts <<'" + M("PROBE") + "'\nT\n" + M("PROBE") + "\n"))).toBe(true);
});

test("§2.2 types", () => {
  expectTypeOf(cardTsconfig).toEqualTypeOf<(exclude: readonly string[]) => string>();
  expectTypeOf(vitestConfig).toEqualTypeOf<(id: string) => string>();
  expectTypeOf(probeDir).toEqualTypeOf<
    (id: string, guard: string, firstdiff: string, probe: string | null, exclude: readonly string[]) => string>();
});

// P50 probe for probe-lines (src/cards/probe.ts) — issue #50 F1/F3: the compile lines of a log that name a
// probe file are the orchestrator's data. Record cards/Probe Lines examples 1-2
// (tests/fixtures/cards/probeLogs.json). The go lines are issue #50's, verbatim.
import { expect, test } from "vitest";
import { probeLines } from "../../src/cards/probe.js";
import { fixtureJson } from "../../tests/helpers.js";
import { TREE_PROFILES } from "../../src/language/treeProfiles.js";

const logs = (): Record<string, string> => fixtureJson("cards/probeLogs.json") as Record<string, string>;
const FL = (): string[] => TREE_PROFILES.map((p) => p.fileLine);

test("Probe Lines example 1: a Go probe build error names the probe file, once per line", () => {
  const got = probeLines(logs()["go"] ?? "", FL());
  expect(got).toStrictEqual([
    "users/token-lookup_probe_test.go:30:72: undefined: adaH",
    "users/token-lookup_probe_test.go:31:72: undefined: zoeH",
  ]);
});

test("Probe Lines example 2: a TypeScript probe line, not a target's; no other file is a probe line", () => {
  expect(probeLines(logs()["ts"] ?? "", FL())).toStrictEqual([
    "probe/w3/w3.probe.ts(2,10): error TS2305: Module '\"../../src/units/len.js\"' has no exported member 'toYards'.",
  ]);
  expect(probeLines(logs()["none"] ?? "", FL())).toStrictEqual([]);
  expect(probeLines(logs()["absolute"] ?? "", FL())).toStrictEqual([]);
  expect(probeLines(logs()["go"] ?? "", [TREE_PROFILES[TREE_PROFILES.length - 1].fileLine])).toStrictEqual([
    "users/token-lookup_probe_test.go:30:72: undefined: adaH",
    "users/token-lookup_probe_test.go:31:72: undefined: zoeH",
  ]);
});
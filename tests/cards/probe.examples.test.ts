import { expect, test } from "vitest";
import { probeLines } from "../../src/cards/probe.js";
import { fixtureJson } from "../../tests/helpers.js";
import { TREE_PROFILES } from "../../src/language/treeProfiles.js";

const logs = () =>
  fixtureJson("cards/probeLogs.json") as Record<string, string>;

const fileLines = TREE_PROFILES.map((p) => p.fileLine);

test("Probe Lines example 1: the go build log yields the two probe_test.go compile lines", () => {
  const result = probeLines(logs().go, fileLines);
  expect(result).toStrictEqual([
    "users/token-lookup_probe_test.go:30:72: undefined: adaH",
    "users/token-lookup_probe_test.go:31:72: undefined: zoeH",
  ]);
});

test("Probe Lines example 2: tsc yields only the probe line, pytest and the absolute frame yield nothing, and the go profile alone claims the go log", () => {
  const resultTs = probeLines(logs().ts, fileLines);
  expect(resultTs).toStrictEqual([
    'probe/w3/w3.probe.ts(2,10): error TS2305: Module \'"../../src/units/len.js"\' has no exported member \'toYards\'.',
  ]);

  const resultNone = probeLines(logs().none, fileLines);
  expect(resultNone).toStrictEqual([]);

  const resultAbsolute = probeLines(logs().absolute, fileLines);
  expect(resultAbsolute).toStrictEqual([]);

  const resultGo = probeLines(logs().go, [
    TREE_PROFILES[TREE_PROFILES.length - 1].fileLine,
  ]);
  expect(resultGo).toStrictEqual([
    "users/token-lookup_probe_test.go:30:72: undefined: adaH",
    "users/token-lookup_probe_test.go:31:72: undefined: zoeH",
  ]);
});

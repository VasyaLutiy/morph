// P14a probe for check-envelope by docs/TASK_P14_reviewer.md §2.2 (Check Envelope) — git's diff of a range read into
// changed files (name-status and numstat, both -z), each changed file against the Morph commits of the range (its writers),
// git's ownership of the whole history (its last owner) and a scout session's targets (its scope); envelope findings only
// when the range has Morph commits, nothing for .morph/. Record Check Envelope examples 1-4, then the §2.2 rows.
import { test, expect } from "vitest";
import { ENVELOPE_SOURCE, MORPH_DIR, checkEnvelope, readDiff } from "../../src/reviewer/checkEnvelope.js";
import type { ChangedFile, EnvelopeRow, RangeCommit, ScoutScope } from "../../src/reviewer/checkEnvelope.js";
import { readOwnership } from "../../src/git/ownership.js";

const HISTORY: RangeCommit[] = [
  { card: "a-judge", model: "m/x", run: "r2", paths: ["tests/a.examples.test.ts"] },
  { card: "a.r1", model: "m/x", run: "r2", paths: ["src/a.ts"] },
  { card: "b", model: "", run: null, paths: ["src/b.ts", "src/a.ts"] },
];
const OWNERSHIP = readOwnership(HISTORY);
const RANGE = HISTORY.slice(0, 2);
const CHANGED: ChangedFile[] = [
  { path: "src/a.ts", status: "modified", added: 3, deleted: 1 },
  { path: "src/b.ts", status: "modified", added: 1, deleted: 1 },
  { path: "README.md", status: "added", added: 2, deleted: 0 },
  { path: ".morph/runs/r2/report.json", status: "added", added: 40, deleted: 0 },
  { path: "tests/a.examples.test.ts", status: "added", added: 30, deleted: 0 },
];
const OWNERS = ["a.r1 (m/x, run r2)", "b (—, run —)", null, null, "a-judge (m/x, run r2)"];
const SCOUT: ScoutScope = { scoutId: "20261008-225320-74e423b1", targets: ["src/a.ts", "src/c.ts"], contextSlice: ["src/b.ts"] };
const env = (path: string, got: string) => ({ kind: "envelope", source: "primer: ownership", path,
  expected: "written by a Morph card of the range", got: "changed outside every card's targets; " + got });
const scope = (path: string, got: string, expected = "a target of the scout session (src/a.ts, src/c.ts)") =>
  ({ kind: "scope", source: "scout 20261008-225320-74e423b1", path, expected, got });

test("Check Envelope example 1: readDiff of a real -z name-status and numstat pair", () => {
  expect(readDiff("M\0a.ts\0M\0bin.dat\0D\0old.ts\0A\0src/sp ace.ts\0",
    "2\t1\ta.ts\0-\t-\tbin.dat\0" + "0\t1\told.ts\0" + "1\t0\tsrc/sp ace.ts\0")).toStrictEqual([
    { path: "a.ts", status: "modified", added: 2, deleted: 1 },
    { path: "bin.dat", status: "modified", added: null, deleted: null },
    { path: "old.ts", status: "deleted", added: 0, deleted: 1 },
    { path: "src/sp ace.ts", status: "added", added: 1, deleted: 0 },
  ]);
  expect(readDiff("T\0link\0A\0new.ts\0", "12\t0\tnew.ts\0")).toStrictEqual([
    { path: "link", status: "modified", added: null, deleted: null },
    { path: "new.ts", status: "added", added: 12, deleted: 0 },
  ]);
  expect(readDiff("", "")).toStrictEqual([]);
});

test("Check Envelope example 2: writers from the range, owners from the whole history, two envelope findings", () => {
  const got = checkEnvelope({ changed: CHANGED, commits: RANGE, ownership: OWNERSHIP, scout: null });
  const writers = [["a.r1"], [], [], [], ["a-judge"]];
  const rows: EnvelopeRow[] = CHANGED.map((c, i) => ({ ...c, writers: writers[i], owner: OWNERS[i], scope: null }));
  expect(got).toStrictEqual({ applies: true, rows, findings: [
    env("src/b.ts", "last Morph write b (—, run —)"), env("README.md", "no Morph card ever wrote it")] });
});

test("Check Envelope example 3: a range without Morph commits — the envelope does not apply", () => {
  const got = checkEnvelope({ changed: CHANGED, commits: [], ownership: OWNERSHIP, scout: null });
  expect(got).toStrictEqual({ applies: false,
    rows: CHANGED.map((c, i) => ({ ...c, writers: [], owner: OWNERS[i], scope: null })), findings: [] });
});

test("Check Envelope example 4: the scout's scope — target, context, outside, .morph/ none; an unchanged target", () => {
  const got = checkEnvelope({ changed: CHANGED.slice(0, 4), commits: RANGE, ownership: OWNERSHIP, scout: SCOUT });
  expect(got.rows.map((r) => r.scope)).toStrictEqual(["target", "context", "outside", null]);
  expect(got.findings).toStrictEqual([
    env("src/b.ts", "last Morph write b (—, run —)"),
    scope("src/b.ts", "changed, though the scout named it as context"),
    env("README.md", "no Morph card ever wrote it"),
    scope("README.md", "changed, though the scout did not name it"),
    scope("src/c.ts", "unchanged in the range", "changed: the scout named it as a target"),
  ]);
});

test("§2.2 rows: the constants; writers distinct in commit order; a deleted target counts as changed; no envelope without commits but scope still", () => {
  expect([MORPH_DIR, ENVELOPE_SOURCE]).toStrictEqual([".morph/", "primer: ownership"]);
  const commits: RangeCommit[] = [
    { card: "z2", model: "q", run: "r9", paths: ["lib/x.ts", "lib/x.ts"] },
    { card: "z1", model: "q", run: "r9", paths: ["lib/x.ts"] },
    { card: "z2", model: "q", run: "r9", paths: ["lib/x.ts"] },
  ];
  const changed: ChangedFile[] = [{ path: "lib/x.ts", status: "deleted", added: 0, deleted: 9 }];
  const one = checkEnvelope({ changed, commits, ownership: readOwnership(commits), scout: null });
  expect(one.rows[0].writers).toStrictEqual(["z2", "z1"]);
  expect(one.rows[0].owner).toBe("z2 (q, run r9)");
  expect(one.findings).toStrictEqual([]);
  const scout: ScoutScope = { scoutId: "s1", targets: ["lib/x.ts"], contextSlice: [] };
  expect(checkEnvelope({ changed, commits: [], ownership: readOwnership([]), scout }).findings).toStrictEqual([]);
  const other = checkEnvelope({ changed: [{ path: "lib/y.ts", status: "added", added: 1, deleted: 0 }], commits: [],
    ownership: readOwnership([]), scout });
  expect(other.findings).toStrictEqual([
    { kind: "scope", source: "scout s1", path: "lib/y.ts", expected: "a target of the scout session (lib/x.ts)",
      got: "changed, though the scout did not name it" },
    { kind: "scope", source: "scout s1", path: "lib/x.ts", expected: "changed: the scout named it as a target",
      got: "unchanged in the range" },
  ]);
  expect(readDiff("M\0only.ts\0", "")).toStrictEqual([{ path: "only.ts", status: "modified", added: null, deleted: null }]);
});

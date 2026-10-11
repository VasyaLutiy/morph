// P31b probe for plan-notes by docs/TASK_P31b_imports.md §2.2 (src/rules/notes.ts) — issue #42 Must hold 3, ledger 3:
// the plan document names the hand copies a project keeps beside the record. Record Plan Notes examples 1-2
// (tests/fixtures/rules/examples.json).
import { test, expect } from "vitest";
import { planNotes } from "../../src/rules/notes.js";
import type { NoteCard } from "../../src/rules/notes.js";

const LAYERS = "decks/tools/layers.json is not read: the record is the source; delete it";
const note = (id: string, dir: string): string =>
  id + ": checks.json extra 'imports' checks " + dir +
  " against a hand list; the record's rules and dependencies already govern imports per file: remove it";
const C: NoteCard[] = [
  { id: "user-registry", extra: "echo '== imports'; go list ./users\n", targets: ["users/registry.go"] },
  { id: "user-registry-judge", extra: null, targets: ["users/registry_examples_test.go"] },
  { id: "user-secrets", extra: "echo '== clock'; true\n", targets: ["users/secrets.go"] },
  { id: "root-main", extra: "echo '== imports'; true\n", targets: [] },
];

test("Plan Notes example 1: a contract-3 guard gets the layers.json note and one note per imports extra", () => {
  expect(planNotes(C, true, "// morph-guard-contract: 3\n")).toStrictEqual([
    LAYERS, note("user-registry", "users"), note("root-main", "."),
  ]);
  expect(planNotes(C, false, "x\n// morph-guard-contract: 4\n")).toStrictEqual([
    note("user-registry", "users"), note("root-main", "."),
  ]);
});

test("Plan Notes example 2: an older or a hand guard gets no note; no extra, no note", () => {
  expect(planNotes(C, true, "// morph-guard-contract: 2\n")).toStrictEqual([]);
  expect(planNotes(C, true, "// guard\n")).toStrictEqual([]);
  expect(planNotes([], false, "// morph-guard-contract: 3\n")).toStrictEqual([]);
  expect(planNotes([{ id: "a", extra: "echo '== imports'\n", targets: ["a/a.go"] }], false,
    "// morph-guard-contract: 3\n")).toStrictEqual([note("a", "a")]);
});

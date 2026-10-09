// P21 probe for plan-command by docs/TASK_P21a_breaking.md §2.2 (src/cli/planCommand.ts) — a Go --only cut hides, per card,
// the subset's files the run has not written yet (Hide Later over Read Go Tree), issue #12, on the P7b-shaped go-p7b.
// Record Plan Command example 14, then rows. The roots are tmp roots, removed in finally.
import fs from "node:fs";
import { test, expect } from "vitest";
import { planCommand } from "../../src/cli/planCommand.js";
import type { Card } from "../../src/cards/types.js";
import type { CommandResult, PlanArgs, PlanDocument } from "../../src/cli/types.js";
import { fixture, tmpRoot } from "../../tests/helpers.js";
import type { TmpRoot } from "../../tests/helpers.js";

const P7B = ["contour.yaml", "morph-map.json", "go.mod", "internal/testhelp/testhelp.go", "decks/b1/checks.json",
  "decks/b1/parts/_control-contract_probe_test.go", "decks/b1/parts/_phase-loop_probe_test.go", "decks/b1/parts/_runtime-guard_probe_test.go",
  "decks/b1/parts/_daemon-core_probe_test.go", "control/control.go", "control/control_examples_test.go", "supervisor/loop.go",
  "supervisor/guard.go", "supervisor/loop_examples_test.go", "supervisor/guard_examples_test.go", "daemon/daemon.go",
  "daemon/daemon_examples_test.go", "mcp/session.go"];
function p7bRoot(): TmpRoot {
  const r = tmpRoot();
  for (const f of P7B) r.write(f, fixture("go-p7b/" + f));
  r.write("decks/tools/guard.mjs", "// guard\n");
  r.write("decks/tools/firstdiff.mjs", "// firstdiff\n");
  return r;
}
const ONLY = ["control-contract", "phase-loop", "runtime-guard", "daemon-core", "control-contract-judge", "phase-loop-judge",
  "runtime-guard-judge", "daemon-core-judge"];
const args = (over: Partial<PlanArgs>): PlanArgs => ({ name: "plan", root: ".", pretty: false, spec: "contour.yaml", map: "morph-map.json",
  components: ["control", "supervisor", "daemon"], judge: true, out: null, checks: "decks/b1/checks.json", ...over });
const docOf = (res: CommandResult): PlanDocument => {
  expect([res.code, res.code === 0 ? "" : JSON.stringify(res.document)]).toStrictEqual([0, ""]);
  return res.document as PlanDocument;
};
const acc = (d: PlanDocument, id: string): string => d.cards.find((c: Card) => c.customId === id)?.acceptance ?? "";
const count = (s: string, x: string): number => s.split(x).length - 1;
const PL = '{"Replace":{"control/control_examples_test.go":"","supervisor/loop_examples_test.go":"","supervisor/guard.go":"","daemon/daemon.go":"","supervisor/guard_examples_test.go":"","daemon/daemon_examples_test.go":""}}';
const CC = '{"Replace":{"control/control_examples_test.go":"","supervisor/loop_examples_test.go":"","daemon/daemon.go":"","supervisor/guard_examples_test.go":"","daemon/daemon_examples_test.go":""}}';
const CC2 = '{"Replace":{"control/control_examples_test.go":"","supervisor/loop.go":"","supervisor/loop_examples_test.go":"","supervisor/guard.go":"","daemon/daemon.go":"","supervisor/guard_examples_test.go":"","daemon/daemon_examples_test.go":""}}';
const SIB = '{"Replace":{"control/control_examples_test.go":""}}';
const NONE = '{"Replace":{}}';

test("Plan Command example 14: a Go --only re-cut hides what the run has not written; a package something visible imports stays", () => {
  const r = p7bRoot();
  try {
    const only = docOf(planCommand(r.root, args({ only: ONLY })));
    expect(only.generations).toStrictEqual([["control-contract"], ["control-contract-judge", "phase-loop"], ["phase-loop-judge", "runtime-guard"],
      ["daemon-core", "runtime-guard-judge"], ["daemon-core-judge"]]);
    expect([count(acc(only, "phase-loop"), PL), count(acc(only, "control-contract"), CC)]).toStrictEqual([2, 2]);
    const full = docOf(planCommand(r.root, args({})));
    expect(full.generations).toStrictEqual(only.generations);
    expect([count(acc(full, "phase-loop"), SIB), count(acc(full, "phase-loop"), NONE)]).toStrictEqual([1, 1]);
    expect(acc(full, "phase-loop").replace(SIB, PL).replace(NONE, PL)).toBe(acc(only, "phase-loop"));
    expect(acc(only, "daemon-core-judge")).toBe(acc(full, "daemon-core-judge"));
    expect(only.cards.map((c) => ({ ...c, acceptance: null }))).toStrictEqual(full.cards.map((c) => ({ ...c, acceptance: null })));
    fs.rmSync(r.path("mcp/session.go"));
    const bare = docOf(planCommand(r.root, args({ only: ONLY })));
    expect([count(acc(bare, "control-contract"), CC2), count(acc(bare, "control-contract"), CC)]).toStrictEqual([2, 0]);
  } finally {
    r.rm();
  }
});

test("row: middle generations, a sibling in the narrow overlay only, a two-card subset, no --checks, a typescript --only cut", () => {
  const r = p7bRoot();
  try {
    const only = docOf(planCommand(r.root, args({ only: ONLY })));
    expect(count(acc(only, "runtime-guard"), '{"Replace":{"supervisor/loop_examples_test.go":"","daemon/daemon.go":"","supervisor/guard_examples_test.go":"","daemon/daemon_examples_test.go":""}}')).toBe(2);
    expect(count(acc(only, "control-contract-judge"), '{"Replace":{"supervisor/loop.go":"","supervisor/loop_examples_test.go":"","daemon/daemon.go":"","supervisor/guard_examples_test.go":"","daemon/daemon_examples_test.go":""}}')).toBe(1);
    expect(count(acc(only, "control-contract-judge"), '{"Replace":{"supervisor/loop_examples_test.go":"","daemon/daemon.go":"","supervisor/guard_examples_test.go":"","daemon/daemon_examples_test.go":""}}')).toBe(1);
    expect(count(acc(only, "runtime-guard-judge"), '{"Replace":{"daemon/daemon.go":"","daemon/daemon_examples_test.go":""}}')).toBe(2);
    // two cards: daemon/daemon_examples_test.go is outside this subset and keeps daemon.go visible for phase-loop
    const two = docOf(planCommand(r.root, args({ only: ["daemon-core", "phase-loop"] })));
    expect([two.generations, count(acc(two, "phase-loop"), NONE)]).toStrictEqual([[["phase-loop"], ["daemon-core"]], 2]);
    const three = docOf(planCommand(r.root, args({ only: ["daemon-core-judge", "daemon-core", "phase-loop"] })));
    expect(count(acc(three, "phase-loop"), '{"Replace":{"daemon/daemon.go":"","daemon/daemon_examples_test.go":""}}')).toBe(2);
    const bare = docOf(planCommand(r.root, { ...args({ only: ONLY }), checks: undefined }));
    const plainBare = docOf(planCommand(r.root, { ...args({}), checks: undefined }));
    expect(bare.cards).toStrictEqual(plainBare.cards);
  } finally {
    r.rm();
  }
  const t = tmpRoot();
  try {
    t.write("contour.yaml", fixture("planner/deps.yaml"));
    t.write("morph-map.json", fixture("planner/deps.map.json"));
    t.write("docs/deps/yaml.md", "# yaml\n");
    t.write("decks/tools/guard.mjs", "// guard\n");
    t.write("decks/tools/firstdiff.mjs", "// firstdiff\n");
    t.write("decks/d1/checks.json", JSON.stringify({ phase: "d1", cards: [{ id: "read-config", smoke: 3 }, { id: "pad-left", smoke: 2 }] }));
    t.write("decks/d1/parts/read-config.probe.ts", "// probe\n");
    t.write("decks/d1/parts/pad-left.probe.ts", "// probe\n");
    t.write("x/x.go", "package x\n");
    const a: PlanArgs = { name: "plan", root: ".", pretty: false, spec: "contour.yaml", map: "morph-map.json", components: ["conf", "plain"],
      judge: false, out: null, checks: "decks/d1/checks.json" };
    const plain = docOf(planCommand(t.root, a));
    const sub = docOf(planCommand(t.root, { ...a, only: ["pad-left", "read-config"] }));
    expect(sub.cards.map((c) => [c.customId, c.acceptance === acc(plain, c.customId)])).toStrictEqual([["pad-left", true], ["read-config", true]]);
  } finally {
    t.rm();
  }
});

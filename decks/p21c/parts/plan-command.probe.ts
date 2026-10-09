// P21c probe for plan-command by docs/TASK_P21c_transaction.md §2.2 (src/cli/planCommand.ts) — an --only cut with --checks
// is built as one transaction (Build Acceptances transaction: true): no hide, no Go tree read, every acceptance marked.
// Record Plan Command examples 12-14 (as amended by P21c) on go-mini and go-p7b tmp roots, then a row.
import fs from "node:fs";
import { test, expect } from "vitest";
import { planCommand } from "../../src/cli/planCommand.js";
import { TRANSACTION_MARK } from "../../src/cards/transaction.js";
import type { Card } from "../../src/cards/types.js";
import type { PlanArgs, PlanDocument } from "../../src/cli/types.js";
import { fixture, tmpRoot } from "../../tests/helpers.js";
import type { TmpRoot } from "../../tests/helpers.js";

const M = TRANSACTION_MARK + "\n";
const MINI = ["contour.yaml", "morph-map.json", "go.mod", "internal/testhelp/testhelp.go", "decks/m1/checks.json",
  "decks/m1/parts/_clamp-value_probe_test.go", "decks/m1/parts/_percent-of_probe_test.go", "decks/m1/parts/_format-share_probe_test.go"];
const P7B = ["contour.yaml", "morph-map.json", "go.mod", "internal/testhelp/testhelp.go", "decks/b1/checks.json", "decks/b1/parts/_phase-loop_probe_test.go",
  "control/control.go", "control/control_examples_test.go", "supervisor/loop.go", "supervisor/guard.go", "supervisor/loop_examples_test.go",
  "supervisor/guard_examples_test.go", "daemon/daemon.go", "daemon/daemon_examples_test.go", "mcp/session.go", "decks/b1/parts/_control-contract_probe_test.go",
  "decks/b1/parts/_runtime-guard_probe_test.go", "decks/b1/parts/_daemon-core_probe_test.go"];
function rootOf(dir: string, files: string[], map: string | null): TmpRoot {
  const r = tmpRoot();
  for (const f of files) r.write(f, fixture(dir + "/" + f));
  if (map !== null) r.write("morph-map.json", fixture(map));
  r.write("decks/tools/guard.mjs", "// guard\n");
  r.write("decks/tools/firstdiff.mjs", "// firstdiff\n");
  return r;
}
const args = (over: Partial<PlanArgs>): PlanArgs => ({ name: "plan", root: ".", pretty: false, spec: "contour.yaml", map: "morph-map.json",
  components: ["calc", "report"], judge: true, out: "decks/m1/deck.json", checks: "decks/m1/checks.json", ...over });
const of = (cards: readonly Card[], id: string): Card => cards.find((c) => c.customId === id) as Card;
const UN = /X=\$\(git ls-files[^\n]*\n/;
const untracked = (a: string | null): string => (UN.exec(a ?? "") ?? [""])[0];
const U2 = 'X=$(git ls-files --others --exclude-standard | grep -vxF -e report/format_share.go -e calc/percent_of_examples_test.go || true); [ -z "$X" ] || { echo "files left in the tree: $X"; exit 1; }\n';
const U8 = 'X=$(git ls-files --others --exclude-standard | grep -vxF -e control/control.go -e supervisor/loop.go -e supervisor/guard.go -e daemon/daemon.go -e control/control_examples_test.go -e supervisor/loop_examples_test.go -e supervisor/guard_examples_test.go -e daemon/daemon_examples_test.go || true); [ -z "$X" ] || { echo "files left in the tree: $X"; exit 1; }\n';
const ONLY = ["control-contract", "control-contract-judge", "phase-loop", "phase-loop-judge", "runtime-guard", "runtime-guard-judge", "daemon-core", "daemon-core-judge"];

test("Plan Command example 12: --only is a transaction: the mark, no overlay", () => {
  const r = rootOf("go-mini", MINI, "cli/goMini.sameGen.map.json");
  try {
    const full = planCommand(r.root, args({})).document as PlanDocument;
    const po = of(full.cards, "percent-of");
    const res = planCommand(r.root, args({ only: ["percent-of"], out: "decks/m1/only.json" }));
    expect(res.code).toBe(0);
    const only = res.document as PlanDocument;
    expect([only.generations, only.externalDependsOn]).toStrictEqual([[["percent-of"]], {}]);
    expect(only.cards).toStrictEqual([{ ...po, acceptance: M + (po.acceptance ?? "").replace('{"Replace":{"calc/clamp_value.go":""}}', '{"Replace":{}}') }]);
    expect(r.read("decks/m1/only.json")).toBe(JSON.stringify(only.cards, null, 2) + "\n");
  } finally { r.rm(); }
});

test("Plan Command example 13: two kept siblings no longer hide each other; no checks, no mark", () => {
  const r = rootOf("go-mini", MINI, null);
  try {
    const deck = JSON.parse(fixture("cli/goMini.deck.json")) as Card[];
    const two = planCommand(r.root, args({ only: ["percent-of-judge", "format-share"], out: "decks/m1/two.json" })).document as PlanDocument;
    expect(two.cards.map((c) => c.customId)).toStrictEqual(["format-share", "percent-of-judge"]);
    const fs1 = of(deck, "format-share"), pj = of(deck, "percent-of-judge");
    expect(of(two.cards, "format-share")).toStrictEqual({ ...fs1, acceptance: M + (fs1.acceptance ?? "").replace('{"Replace":{"calc/percent_of_examples_test.go":""}}', '{"Replace":{}}').replace(untracked(fs1.acceptance), () => U2) });
    expect(of(two.cards, "percent-of-judge")).toStrictEqual({ ...pj, acceptance: M + (pj.acceptance ?? "").replace('{"Replace":{"report/format_share.go":""}}', '{"Replace":{}}').replace(untracked(pj.acceptance), () => U2) });
    const base = planCommand(r.root, args({ checks: undefined, out: null })).document as PlanDocument;
    const clamp = planCommand(r.root, args({ only: ["clamp-value"], checks: undefined, out: null })).document as PlanDocument;
    expect(clamp.cards).toStrictEqual([of(base.cards, "clamp-value")]);
  } finally { r.rm(); }
});

test("Plan Command example 14: go-p7b --only, every acceptance marked, nothing hidden, the tree not read", () => {
  const r = rootOf("go-p7b", P7B, null);
  try {
    const a14 = (o: Partial<PlanArgs>): PlanArgs => args({ components: ["control", "supervisor", "daemon"], checks: "decks/b1/checks.json", out: null, ...o });
    const only = planCommand(r.root, a14({ only: ONLY })).document as PlanDocument;
    const plain = planCommand(r.root, a14({})).document as PlanDocument;
    expect(only.cards.every((c) => (c.acceptance ?? "").startsWith(M))).toBe(true);
    const pl = of(only.cards, "phase-loop").acceptance ?? "";
    expect([pl.split('{"Replace":{}}').length - 1, pl.includes('"supervisor/guard.go":""'), untracked(pl)]).toStrictEqual([2, false, U8]);
    for (const id of ONLY) {
      const b = of(plain.cards, id).acceptance ?? "";
      const first = (/\{"Replace":\{[^}]*\}\}/.exec(b) ?? ['{"Replace":{}}'])[0];
      expect(of(only.cards, id).acceptance).toBe(M + b.replace(first, '{"Replace":{}}').replace(untracked(b), () => U8));
    }
    fs.rmSync(r.path("mcp/session.go"));
    expect((planCommand(r.root, a14({ only: ONLY })).document as PlanDocument).cards).toStrictEqual(only.cards);
  } finally { r.rm(); }
});

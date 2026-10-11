import fs from "node:fs";
import { test, expect } from "vitest";
import { planCommand } from "../../src/cli/planCommand.js";
import { TRANSACTION_MARK } from "../../src/cards/transaction.js";
import { tmpRoot, fixture } from "../helpers.js";
import type { TmpRoot } from "../helpers.js";
import type { PlanArgs, PlanDocument } from "../../src/cli/types.js";
import type { Card } from "../../src/cards/types.js";

const P7B1 = [
  "contour.yaml",
  "morph-map.json",
  "go.mod",
  "internal/testhelp/testhelp.go",
  "decks/b1/checks.json",
  "decks/b1/parts/_phase-loop_probe_test.go",
  "control/control.go",
  "control/control_examples_test.go",
  "supervisor/loop.go",
  "supervisor/guard.go",
  "supervisor/loop_examples_test.go",
  "supervisor/guard_examples_test.go",
  "daemon/daemon.go",
  "daemon/daemon_examples_test.go",
  "mcp/session.go",
];

const P7B = [
  ...P7B1,
  "decks/b1/parts/_control-contract_probe_test.go",
  "decks/b1/parts/_runtime-guard_probe_test.go",
  "decks/b1/parts/_daemon-core_probe_test.go",
];

function p7bRoot(): TmpRoot {
  const r = tmpRoot();
  for (const f of P7B) r.write(f, fixture("go-p7b/" + f));
  r.write("decks/tools/guard.mjs", "// guard\n");
  r.write("decks/tools/firstdiff.mjs", "// firstdiff\n");
  return r;
}

const args = (over: Partial<PlanArgs>): PlanArgs => ({
  name: "plan",
  root: ".",
  pretty: false,
  spec: "contour.yaml",
  map: "morph-map.json",
  components: ["control", "supervisor", "daemon"],
  judge: true,
  out: null,
  checks: "decks/b1/checks.json",
  ...over,
});

test("Plan Command example 14", () => {
  const r = p7bRoot();
  try {
    const only = [
      "control-contract",
      "control-contract-judge",
      "phase-loop",
      "phase-loop-judge",
      "runtime-guard",
      "runtime-guard-judge",
      "daemon-core",
      "daemon-core-judge",
    ];
    const count = (s: string, sub: string): number => s.split(sub).length - 1;
    const UN = /X=\$\(git ls-files[^\n]*\n/;
    const U8 = "X=$(git ls-files --others --exclude-standard | grep -vxF -e control/control.go -e supervisor/loop.go -e supervisor/guard.go -e daemon/daemon.go -e control/control_examples_test.go -e supervisor/loop_examples_test.go -e supervisor/guard_examples_test.go -e daemon/daemon_examples_test.go || true); [ -z \"$X\" ] || { echo \"files left in the tree: $X\"; exit 1; }\n";

    const resOnly = planCommand(r.root, args({ only }));
    expect(resOnly.code).toBe(0);
    const docOnly = resOnly.document as PlanDocument;
    expect(docOnly.generations).toStrictEqual([
      ["control-contract"],
      ["control-contract-judge", "phase-loop"],
      ["phase-loop-judge", "runtime-guard"],
      ["daemon-core", "runtime-guard-judge"],
      ["daemon-core-judge"],
    ]);
    const idsOnly = docOnly.cards.map((c) => c.customId);
    expect(idsOnly.length).toBe(8);
    expect([...idsOnly].sort()).toStrictEqual([...only].sort());

    for (const card of docOnly.cards) {
      const acceptance = card.acceptance ?? "";
      expect(acceptance.startsWith(TRANSACTION_MARK + "\n")).toBe(true);
      expect(count(acceptance, U8)).toBe(1);
    }
    const phaseLoopOnly = docOnly.cards.find((c) => c.customId === "phase-loop") as Card;
    expect(count(phaseLoopOnly.acceptance ?? "", '{"Replace":{}}')).toBe(2);
    expect(count(phaseLoopOnly.acceptance ?? "", '"supervisor/guard.go":""')).toBe(0);

    const resPlain = planCommand(r.root, args({}));
    expect(resPlain.code).toBe(0);
    const docPlain = resPlain.document as PlanDocument;
    expect(docPlain.generations).toStrictEqual(docOnly.generations);
    expect(docPlain.cards.map((c) => c.customId)).toStrictEqual(idsOnly);

    const phaseLoopPlain = docPlain.cards.find((c) => c.customId === "phase-loop") as Card;
    expect(count(phaseLoopPlain.acceptance ?? "", '{"Replace":{"control/control_examples_test.go":""}}')).toBe(1);
    expect(count(phaseLoopPlain.acceptance ?? "", '{"Replace":{}}')).toBe(1);

    for (const plain of docPlain.cards) {
      const cut = docOnly.cards.find((c) => c.customId === plain.customId) as Card;
      const expected = TRANSACTION_MARK + "\n" + (plain.acceptance ?? "")
        .replace(/\{"Replace":\{(?!}})[^}]*}}/, '{"Replace":{}}')
        .replace(UN, () => U8);
      expect(cut.acceptance).toBe(expected);
    }

    fs.rmSync(r.path("mcp/session.go"));
    const resNoMcp = planCommand(r.root, args({ only }));
    expect(resNoMcp.code).toBe(0);
    const docNoMcp = resNoMcp.document as PlanDocument;
    expect(docNoMcp.cards).toStrictEqual(docOnly.cards);
  } finally {
    r.rm();
  }
});

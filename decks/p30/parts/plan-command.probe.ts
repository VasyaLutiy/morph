// P30 probe for plan-command by docs/TASK_P30_rules.md §2.2 (src/cli/planCommand.ts) — issue #41: with
// decks/tools/layers.json, Plan Layers refuses an old guard, else its edges reach the guard lines; the subset reads
// the whole record; a Component named like a dependency is refused. Record Plan Command example 15 (examples.json).
import { test, expect } from "vitest";
import { planCommand } from "../../src/cli/planCommand.js";
import { fixture, tmpRoot } from "../../tests/helpers.js";
import type { Card } from "../../src/cards/types.js";
import type { PlanArgs, PlanDocument } from "../../src/cli/types.js";

const MINI = ["contour.yaml", "morph-map.json", "go.mod", "internal/testhelp/testhelp.go", "decks/m1/checks.json",
  "decks/m1/parts/_clamp-value_probe_test.go", "decks/m1/parts/_percent-of_probe_test.go", "decks/m1/parts/_format-share_probe_test.go"];
const args: PlanArgs = {
  name: "plan", root: ".", pretty: false, spec: "contour.yaml", components: ["calc", "report"], map: "morph-map.json",
  judge: true, out: "decks/m1/deck.json", checks: "decks/m1/checks.json",
};
const TAG = "MORPH_GUARD" + "_EOF"; // the tag itself may not appear in a probe (it is inlined in a heredoc)
const HEREDOC = "<<'" + TAG + "'\n// guard\n" + TAG + "\n";
const HEREDOC2 = "<<'" + TAG + "'\n// morph-guard-contract: 2\n" + TAG + "\n";
const LINES: Record<string, [string, string]> = {
  "clamp-value": ["node $P/guard.mjs src calc/clamp_value.go\n", "node $P/guard.mjs src calc/clamp_value.go '' '{\"calc\":[]}'\n"],
  "percent-of": ["node $P/guard.mjs src calc/percent_of.go\n", "node $P/guard.mjs src calc/percent_of.go '' '{\"calc\":[]}'\n"],
  "format-share": ["node $P/guard.mjs src report/format_share.go\n", "node $P/guard.mjs src report/format_share.go '' '{\"report\":[\"calc\"]}'\n"],
};

test("Plan Command example 15: layers.json makes Plan Layers speak: an old guard refused, the edges in the guard lines, the subset reads the whole record, a name both a Component and a dependency refused", () => {
  const r = tmpRoot();
  try {
    for (const f of MINI) r.write(f, fixture("go-mini/" + f));
    r.write("decks/tools/guard.mjs", "// guard\n");
    r.write("decks/tools/firstdiff.mjs", "// firstdiff\n");
    r.write("decks/tools/layers.json", "{\"pure\": []}\n");
    const old = planCommand(r.root, args);
    expect(old.code).toBe(2);
    expect(old.document).toStrictEqual({ error: { code: 2, kind: "DeckError", message: "decks/tools/guard.mjs speaks contract 1: copy templates/go/decks/tools/guard.mjs from MorphV2" } });
    expect(r.exists("decks/m1/deck.json")).toBe(false);

    r.write("decks/tools/guard.mjs", "// morph-guard-contract: 2\n");
    const ok = planCommand(r.root, args);
    expect(ok.code).toBe(0);
    const golden = JSON.parse(fixture("cli/goMini.deck.json")) as Card[];
    const want = golden.map((c) => {
      let a = (c.acceptance ?? "").replace(HEREDOC, HEREDOC2);
      const pair = LINES[c.customId];
      if (pair !== undefined) {
        expect(a).toContain(pair[0]);
        a = a.replace(pair[0], pair[1]);
      }
      return { ...c, acceptance: a };
    });
    expect((ok.document as PlanDocument).cards).toStrictEqual(want);

    const only = planCommand(r.root, { ...args, only: ["format-share"], out: "decks/m1/only.json" });
    expect(only.code).toBe(0);
    const cards = (only.document as PlanDocument).cards;
    expect(cards.map((c) => c.customId)).toStrictEqual(["format-share"]);
    expect(cards[0].acceptance).toContain(LINES["format-share"][1]);

    r.write("contour.yaml", fixture("go-mini/contour.yaml") + "  dependencies:\n    - {name: calc, version: \"v1.0.0\", language: go}\n");
    const bothOut = planCommand(r.root, { ...args, out: "decks/m1/both.json" });
    expect(bothOut.code).toBe(2);
    expect(bothOut.document).toStrictEqual({ error: { code: 2, kind: "DeckError", message: "Function 'Format Share': 'uses: calc' names the Component 'calc' and the dependency 'calc'" } });
    expect(r.exists("decks/m1/both.json")).toBe(false);
  } finally {
    r.rm();
  }
});

// P31a probe for plan-command by docs/TASK_P31a_guardrails.md §2.2 (src/cli/planCommand.ts) — issues #42, #46: the
// guard's contract line, not layers.json, decides what the guard lines get; the rules of the record's canonical
// Guardrails follow the layers; prose-only names in the document. Record Plan Command example 19 (examples.json).
import { test, expect } from "vitest";
import fs from "node:fs";
import { planCommand } from "../../src/cli/planCommand.js";
import { fixture, tmpRoot } from "../../tests/helpers.js";
import type { Card } from "../../src/cards/types.js";
import type { PlanArgs, PlanDocument } from "../../src/cli/types.js";

const MINI = ["morph-map.json", "go.mod", "internal/testhelp/testhelp.go", "decks/m1/checks.json",
  "decks/m1/parts/_clamp-value_probe_test.go", "decks/m1/parts/_percent-of_probe_test.go", "decks/m1/parts/_format-share_probe_test.go"];
const args: PlanArgs = {
  name: "plan", root: ".", pretty: false, spec: "contour.yaml", components: ["calc", "report"], map: "morph-map.json",
  judge: true, out: "decks/m1/deck.json", checks: "decks/m1/checks.json",
};
const TAG = "MORPH_GUARD" + "_EOF"; // the tag itself may not appear in a probe (it is inlined in a heredoc)
const HEREDOC = "<<'" + TAG + "'\n// guard\n" + TAG + "\n";
const HEREDOC3 = "<<'" + TAG + "'\n// morph-guard-contract: 3\n" + TAG + "\n";
const SHELL = "\"no-shell\":\"Guardrail \\u0027No Shell\\u0027 of System mini\"";
const CALC = " '' '{\"calc\":[]}' '{\"calc\":{" + SHELL + ",\"pure\":\"Guardrail \\u0027Pure\\u0027 of Component calc\"}}'\n";
const LINES: Record<string, [string, string]> = {
  "clamp-value": ["node $P/guard.mjs src calc/clamp_value.go\n", "node $P/guard.mjs src calc/clamp_value.go" + CALC],
  "percent-of": ["node $P/guard.mjs src calc/percent_of.go\n", "node $P/guard.mjs src calc/percent_of.go" + CALC],
  "format-share": ["node $P/guard.mjs src report/format_share.go\n",
    "node $P/guard.mjs src report/format_share.go '' '{\"report\":[\"calc\"]}' '{\"report\":{" + SHELL + "}}'\n"],
};

test("Plan Command example 19: a contract-3 guard gets the layers and the rules with or without layers.json, a contract-2 guard with rules is refused, a hand guard gets nothing", () => {
  const r = tmpRoot();
  try {
    for (const f of MINI) r.write(f, fixture("go-mini/" + f));
    r.write("contour.yaml", fixture("cli/goMiniGuarded.yaml"));
    r.write("decks/tools/guard.mjs", "// morph-guard-contract: 3\n");
    r.write("decks/tools/firstdiff.mjs", "// firstdiff\n");
    const golden = JSON.parse(fixture("cli/goMiniGuarded.deck.json")) as Card[];
    const three = planCommand(r.root, args);
    expect(three.code).toBe(0);
    const want = golden.map((c) => {
      let a = (c.acceptance ?? "").replace(HEREDOC, HEREDOC3);
      const pair = LINES[c.customId];
      if (pair !== undefined) {
        expect(a).toContain(pair[0]);
        a = a.replace(pair[0], pair[1]);
      }
      return { ...c, acceptance: c.acceptance === null ? null : a };
    });
    expect(JSON.parse(r.read("decks/m1/deck.json"))).toStrictEqual(want);
    const doc = three.document as PlanDocument & { proseOnly?: string[] };
    expect(Object.keys(doc)).toStrictEqual(["spec", "components", "cards", "generations", "externalDependsOn", "out", "proseOnly", "warnings"]);
    expect(doc.proseOnly).toStrictEqual(["Frozen Tree During Run"]);

    r.write("decks/tools/layers.json", "{\"layers\": {\"calc\": [\"report\"]}, \"pure\": [\"calc\"]}\n");
    expect(planCommand(r.root, { ...args, out: "decks/m1/again.json" }).code).toBe(0);
    expect(r.read("decks/m1/again.json")).toBe(r.read("decks/m1/deck.json"));

    r.write("decks/tools/guard.mjs", "// morph-guard-contract: 2\n");
    const two = planCommand(r.root, { ...args, out: "decks/m1/two.json" });
    expect(two.code).toBe(2);
    expect(two.document).toStrictEqual({ error: { code: 2, kind: "DeckError", message: "decks/tools/guard.mjs speaks contract 2: copy templates/go/decks/tools/guard.mjs from MorphV2" } });
    expect(r.exists("decks/m1/two.json")).toBe(false);

    r.write("decks/tools/guard.mjs", "// guard\n");
    fs.rmSync(r.path("decks/tools/layers.json"));
    const hand = planCommand(r.root, { ...args, out: "decks/m1/hand.json" });
    expect(hand.code).toBe(0);
    expect(JSON.parse(r.read("decks/m1/hand.json"))).toStrictEqual(golden);
    expect("proseOnly" in (hand.document as object)).toBe(false);
  } finally {
    r.rm();
  }
});

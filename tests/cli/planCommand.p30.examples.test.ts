import { expect, test } from "vitest";
import { planCommand } from "../../src/cli/planCommand.js";
import { fixture, tmpRoot } from "../helpers.js";
import type { Card } from "../../src/cards/types.js";
import type { PlanArgs, PlanDocument } from "../../src/cli/types.js";

const MINI = [
  "contour.yaml",
  "morph-map.json",
  "go.mod",
  "internal/testhelp/testhelp.go",
  "decks/m1/checks.json",
  "decks/m1/parts/_clamp-value_probe_test.go",
  "decks/m1/parts/_percent-of_probe_test.go",
  "decks/m1/parts/_format-share_probe_test.go",
];

test("Plan Command example 15: layers.json, the guard contract 2 and the layers from the record", () => {
  const r = tmpRoot();
  try {
    for (const f of MINI) {
      r.write(f, fixture("go-mini/" + f));
    }
    r.write("decks/tools/guard.mjs", "// guard\n");
    r.write("decks/tools/firstdiff.mjs", "// firstdiff\n");
    r.write("decks/tools/layers.json", "{\"pure\": []}\n");
    const args: PlanArgs = {
      name: "plan",
      root: ".",
      pretty: false,
      spec: "contour.yaml",
      components: ["calc", "report"],
      map: "morph-map.json",
      judge: true,
      out: "decks/m1/deck.json",
      checks: "decks/m1/checks.json",
    };

    const contract1 = planCommand(r.root, args);
    expect(contract1.code).toBe(2);
    expect(contract1.document).toStrictEqual({
      error: {
        code: 2,
        kind: "DeckError",
        message:
          "decks/tools/guard.mjs speaks contract 1: copy templates/go/decks/tools/guard.mjs from MorphV2",
      },
    });
    expect(r.exists("decks/m1/deck.json")).toBe(false);

    r.write("decks/tools/guard.mjs", "// morph-guard-contract: 2\n");
    const golden = JSON.parse(fixture("cli/goMini.deck.json")) as Card[];
    const expected = golden.map((card): Card => {
      if (card.acceptance === null) return { ...card };
      const acceptance = card.acceptance.replace(
        "\n// guard\n",
        "\n// morph-guard-contract: 2\n",
      );
      if (card.customId === "clamp-value") {
        return {
          ...card,
          acceptance: acceptance.replace(
            "node $P/guard.mjs src calc/clamp_value.go",
            "node $P/guard.mjs src calc/clamp_value.go '' '{\"calc\":[]}'",
          ),
        };
      }
      if (card.customId === "percent-of") {
        return {
          ...card,
          acceptance: acceptance.replace(
            "node $P/guard.mjs src calc/percent_of.go",
            "node $P/guard.mjs src calc/percent_of.go '' '{\"calc\":[]}'",
          ),
        };
      }
      if (card.customId === "format-share") {
        return {
          ...card,
          acceptance: acceptance.replace(
            "node $P/guard.mjs src report/format_share.go",
            "node $P/guard.mjs src report/format_share.go '' '{\"report\":[\"calc\"]}'",
          ),
        };
      }
      return { ...card, acceptance };
    });

    const full = planCommand(r.root, args);
    expect(full.code).toBe(0);
    expect((full.document as PlanDocument).cards).toStrictEqual(expected);
    expect(r.read("decks/m1/deck.json")).toBe(JSON.stringify(expected, null, 2) + "\n");

    const only = planCommand(r.root, {
      ...args,
      only: ["format-share"],
      out: "decks/m1/only.json",
    });
    expect(only.code).toBe(0);
    const onlyDocument = only.document as PlanDocument;
    expect(onlyDocument.cards.length).toBe(1);
    expect(onlyDocument.cards[0].customId).toBe("format-share");
    expect(onlyDocument.cards[0].acceptance).toContain(
      "node $P/guard.mjs src report/format_share.go '' '{\"report\":[\"calc\"]}'",
    );

    r.write(
      "contour.yaml",
      fixture("go-mini/contour.yaml") +
        "  dependencies:\n    - {name: calc, version: \"v1.0.0\", language: go}\n",
    );
    const both = planCommand(r.root, { ...args, out: "decks/m1/both.json" });
    expect(both.code).toBe(2);
    expect(both.document).toStrictEqual({
      error: {
        code: 2,
        kind: "DeckError",
        message:
          "Function 'Format Share': 'uses: calc' names the Component 'calc' and the dependency 'calc'",
      },
    });
    expect(r.exists("decks/m1/both.json")).toBe(false);
  } finally {
    r.rm();
  }
});

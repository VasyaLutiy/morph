import { expect, test } from "vitest";
import { planCommand } from "../../src/cli/planCommand.js";
import { fixture, tmpRoot } from "../helpers.js";
import type { Card } from "../../src/cards/types.js";
import type { PlanArgs } from "../../src/cli/types.js";

const MINI = [
  "contour.yaml",
  "morph-map.json",
  "go.mod",
  "internal/testhelp/testhelp.go",
  "decks/m1/parts/_percent-of_probe_test.go",
  "decks/m1/parts/_format-share_probe_test.go",
];

type Tmp = ReturnType<typeof tmpRoot>;

function writeMini(r: Tmp, checks: string): void {
  for (const f of MINI) {
    r.write(f, fixture("go-mini/" + f));
  }
  r.write("decks/tools/guard.mjs", "// guard\n");
  r.write("decks/tools/firstdiff.mjs", "// firstdiff\n");
  r.write("decks/m1/checks.json", checks);
}

function args(out: string | null, writeProbes: boolean): PlanArgs {
  const base: PlanArgs = {
    name: "plan",
    root: ".",
    pretty: false,
    spec: "contour.yaml",
    components: ["calc", "report"],
    map: "morph-map.json",
    judge: true,
    checks: "decks/m1/checks.json",
    out,
  };
  if (writeProbes) return { ...base, writeProbes: true };
  return base;
}

test("Plan Command example 24: --write-probes writes the skeleton, then the deck reads it", () => {
  const r = tmpRoot();
  try {
    writeMini(r, fixture("cli/goMini.cut.checks.json"));

    const first = planCommand(r.root, args(null, true));
    expect(first.code).toBe(0);
    expect(first.document).toStrictEqual({
      spec: "contour.yaml",
      components: ["calc", "report"],
      probes: ["decks/m1/parts/_clamp-value_probe_test.go"],
    });
    expect(r.read("decks/m1/parts/_clamp-value_probe_test.go")).toBe(
      fixture("criterion/skeleton2.probe.go.txt"),
    );
    expect(r.read("decks/m1/parts/_percent-of_probe_test.go")).toBe(
      fixture("go-mini/decks/m1/parts/_percent-of_probe_test.go"),
    );
    expect(r.read("decks/m1/parts/_format-share_probe_test.go")).toBe(
      fixture("go-mini/decks/m1/parts/_format-share_probe_test.go"),
    );
    expect(r.exists("decks/m1/deck.json")).toBe(false);

    const second = planCommand(r.root, args("decks/m1/deck.json", false));
    expect(second.code).toBe(0);
    expect(r.exists("decks/m1/deck.json")).toBe(true);
    const cards = JSON.parse(r.read("decks/m1/deck.json")) as Card[];
    const clamp = cards.find((c) => c.customId === "clamp-value") as Card;
    expect(clamp.acceptance).toContain("TestProbeClampValueExample4");

    const third = planCommand(r.root, args(null, true));
    expect(third.code).toBe(0);
    expect(third.document).toStrictEqual({
      spec: "contour.yaml",
      components: ["calc", "report"],
      probes: [],
    });
    expect(r.read("decks/m1/parts/_clamp-value_probe_test.go")).toBe(
      fixture("criterion/skeleton2.probe.go.txt"),
    );
  } finally {
    r.rm();
  }
});

test("Plan Command example 25: a checks error writes no probe; the old form writes it", () => {
  const r = tmpRoot();
  try {
    writeMini(r, fixture("cli/goMini.nope.checks.json"));

    const first = planCommand(r.root, args(null, true));
    expect(first.code).toBe(2);
    expect(first.document).toStrictEqual({
      error: {
        code: 2,
        kind: "DeckError",
        message:
          "checks defaults not built (1 error):\n" +
          "checks override 'nope' is not a card of the cut",
      },
    });
    expect(r.exists("decks/m1/parts/_clamp-value_probe_test.go")).toBe(false);

    r.write("decks/m1/checks.json", fixture("go-mini/decks/m1/checks.json"));
    const second = planCommand(r.root, args(null, true));
    expect(second.code).toBe(0);
    expect(second.document).toStrictEqual({
      spec: "contour.yaml",
      components: ["calc", "report"],
      probes: ["decks/m1/parts/_clamp-value_probe_test.go"],
    });
    expect(r.read("decks/m1/parts/_clamp-value_probe_test.go")).toBe(
      fixture("criterion/skeleton2.probe.go.txt"),
    );
  } finally {
    r.rm();
  }
});

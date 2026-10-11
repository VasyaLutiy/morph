import { expect, test } from "vitest";
import { planCommand } from "../../src/cli/planCommand.js";
import { codeAcceptance } from "../../src/builder/compose.js";
import { GO_ENV, goCodeAcceptance } from "../../src/builder/goAcceptance.js";
import { DEFAULT_FROZEN } from "../../src/builder/readChecks.js";
import { GO, TYPESCRIPT } from "../../src/language/profiles.js";
import { fixture, tmpRoot } from "../helpers.js";
import type { CardContext } from "../../src/builder/types.js";
import type { Card } from "../../src/cards/types.js";
import type { PlanDocument } from "../../src/cli/types.js";

function findCard(cards: readonly Card[], id: string): Card {
  const card = cards.find((c) => c.customId === id);
  if (card === undefined) {
    throw new Error("card not found: " + id);
  }
  return card;
}

test("Plan Command example 10: a TypeScript deck whose checks name cards of Components with declared dependencies", () => {
  const r = tmpRoot();
  try {
    r.write("contour.yaml", fixture("planner/deps.yaml"));
    r.write("morph-map.json", fixture("planner/deps.map.json"));
    r.write("docs/deps/yaml.md", "# yaml\n");
    r.write("decks/tools/guard.mjs", "// guard\n");
    r.write("decks/tools/firstdiff.mjs", "// firstdiff\n");
    r.write(
      "decks/d1/checks.json",
      JSON.stringify({ phase: "d1", cards: [{ id: "read-config", smoke: 3 }, { id: "pad-left", smoke: 2 }] }),
    );
    r.write("decks/d1/parts/read-config.probe.ts", "// probe\n");
    r.write("decks/d1/parts/pad-left.probe.ts", "// probe\n");

    const first = planCommand(r.root, {
      name: "plan",
      root: ".",
      pretty: false,
      spec: "contour.yaml",
      map: "morph-map.json",
      components: ["conf", "plain"],
      judge: false,
      out: "decks/d1/deck.json",
      checks: "decks/d1/checks.json",
    });
    expect(first.code).toBe(0);
    const doc = first.document as PlanDocument;
    expect(doc.cards.map((c) => c.customId)).toStrictEqual(["pad-left", "read-config", "check-config"]);

    const pad = findCard(doc.cards, "pad-left");
    const readConfig = findCard(doc.cards, "read-config");
    const checkConfig = findCard(doc.cards, "check-config");

    expect(pad.targets).toStrictEqual(["src/plain/padLeft.ts", "tests/plain/padLeft.test.ts"]);
    expect(readConfig.targets).toStrictEqual(["src/conf/readConfig.ts", "tests/conf/readConfig.test.ts"]);
    expect(checkConfig.targets).toStrictEqual(["src/conf/checkConfig.ts", "tests/conf/checkConfig.test.ts"]);

    const padCtx: CardContext = {
      id: "pad-left",
      phase: "d1",
      targets: ["src/plain/padLeft.ts", "tests/plain/padLeft.test.ts"],
      siblings: ["src/conf/readConfig.ts", "tests/conf/readConfig.test.ts"],
      frozen: DEFAULT_FROZEN,
      fullExclude: [],
      ownGit: false,
      profile: TYPESCRIPT,
      guard: "// guard\n",
      firstdiff: "// firstdiff\n",
      allowed: [],
      vendor: false,
    };
    const expectedPadLeft = codeAcceptance(padCtx, "// probe\n", 2, null);
    expect(expectedPadLeft).toContain(
      "node $P/guard.mjs src src/plain/padLeft.ts; node $P/guard.mjs tests tests/plain/padLeft.test.ts 1 2\n",
    );
    expect(pad.acceptance).toBe(expectedPadLeft);

    const readConfigCtx: CardContext = {
      id: "read-config",
      phase: "d1",
      targets: ["src/conf/readConfig.ts", "tests/conf/readConfig.test.ts"],
      siblings: ["src/plain/padLeft.ts", "tests/plain/padLeft.test.ts"],
      frozen: DEFAULT_FROZEN,
      fullExclude: [],
      ownGit: false,
      profile: TYPESCRIPT,
      guard: "// guard\n",
      firstdiff: "// firstdiff\n",
      allowed: ["yaml", "zod"],
      vendor: false,
    };
    const expectedReadConfig = codeAcceptance(readConfigCtx, "// probe\n", 3, null);
    expect(expectedReadConfig).toContain(
      "node $P/guard.mjs src src/conf/readConfig.ts 'yaml,zod'; node $P/guard.mjs tests tests/conf/readConfig.test.ts 1 3\n",
    );
    expect(readConfig.acceptance).toBe(expectedReadConfig);

    const noChecks = planCommand(r.root, {
      name: "plan",
      root: ".",
      pretty: false,
      spec: "contour.yaml",
      map: "morph-map.json",
      components: ["conf", "plain"],
      judge: false,
      out: null,
    });
    expect(noChecks.code).toBe(0);
    const planned = findCard((noChecks.document as PlanDocument).cards, "check-config");
    expect(checkConfig.acceptance).toBe(planned.acceptance);

    r.write("vendor/modules.txt", "# github.com/google/go-cmp v0.7.0\n");

    const second = planCommand(r.root, {
      name: "plan",
      root: ".",
      pretty: false,
      spec: "contour.yaml",
      map: "morph-map.json",
      components: ["conf", "plain"],
      judge: false,
      out: "decks/d1/deck2.json",
      checks: "decks/d1/checks.json",
    });
    expect(second.code).toBe(0);
    expect(r.read("decks/d1/deck2.json")).toBe(r.read("decks/d1/deck.json"));
  } finally {
    r.rm();
  }
});

test("Plan Command example 11: a Go deck whose checks name a card of a Component with a declared dependency", () => {
  const r = tmpRoot();
  try {
    r.write("contour.yaml", fixture("planner/deps.yaml"));
    r.write("morph-map.json", fixture("planner/deps.map.json"));
    r.write("docs/deps/yaml.md", "# yaml\n");
    r.write("docs/deps/go-cmp.md", "# go-cmp\n");
    r.write("decks/tools/guard.mjs", "// guard\n");
    r.write("decks/tools/firstdiff.mjs", "// firstdiff\n");
    r.write("decks/d2/checks.json", JSON.stringify({ phase: "d2", cards: [{ id: "diff-values", smoke: 4 }] }));
    r.write("decks/d2/parts/_diff-values_probe_test.go", "package diff\n");

    const first = planCommand(r.root, {
      name: "plan",
      root: ".",
      pretty: false,
      spec: "contour.yaml",
      map: "morph-map.json",
      components: ["diff"],
      judge: false,
      out: "decks/d2/deck.json",
      checks: "decks/d2/checks.json",
    });
    expect(first.code).toBe(0);
    const doc = first.document as PlanDocument;
    expect(doc.cards.map((c) => c.customId)).toStrictEqual(["diff-values"]);
    const diff = findCard(doc.cards, "diff-values");
    expect(diff.targets).toStrictEqual(["diff/diff_values.go", "diff/diff_values_test.go"]);

    const diffCtx: CardContext = {
      id: "diff-values",
      phase: "d2",
      targets: ["diff/diff_values.go", "diff/diff_values_test.go"],
      siblings: [],
      frozen: DEFAULT_FROZEN,
      fullExclude: [],
      ownGit: false,
      profile: GO,
      guard: "// guard\n",
      firstdiff: "// firstdiff\n",
      allowed: ["github.com/google/go-cmp"],
      vendor: false,
    };
    const expected = goCodeAcceptance(diffCtx, "package diff\n", 4, null);
    expect(expected.split(GO_ENV).length - 1).toBe(1);
    expect(expected).toContain("export GOFLAGS=-mod=mod ");
    expect(expected).toContain(
      "node $P/guard.mjs src diff/diff_values.go 'github.com/google/go-cmp'; node $P/guard.mjs tests diff/diff_values_test.go 1 4\n",
    );
    expect(diff.acceptance).toBe(expected);

    r.write(
      "vendor/modules.txt",
      "# github.com/google/go-cmp v0.7.0\n## explicit; go 1.11\ngithub.com/google/go-cmp/cmp\n",
    );
    const second = planCommand(r.root, {
      name: "plan",
      root: ".",
      pretty: false,
      spec: "contour.yaml",
      map: "morph-map.json",
      components: ["diff"],
      judge: false,
      out: "decks/d2/deck2.json",
      checks: "decks/d2/checks.json",
    });
    expect(second.code).toBe(0);
    const doc2 = second.document as PlanDocument;
    const diff2 = findCard(doc2.cards, "diff-values");
    expect({ ...diff2, acceptance: diff.acceptance }).toStrictEqual(diff);
    const expectedVendor = expected.replace("export GOFLAGS=-mod=mod ", "export GOFLAGS=-mod=vendor ");
    expect(expectedVendor).toContain("export GOFLAGS=-mod=vendor ");
    expect(diff2.acceptance).toBe(expectedVendor);
  } finally {
    r.rm();
  }
});

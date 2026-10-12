// P37 probe for suite-net (src/cli/suiteNet.ts) — issue #49: the whole suite once per run when the deck's acceptances
// ran only the related tests. Record cli/Suite Net examples 1-4 (tests/fixtures/cli/examples.json, suiteNet.json).
import fs from "node:fs";
import { test, expect } from "vitest";
import { suiteNet } from "../../src/cli/suiteNet.js";
import { fixtureJson, tmpRoot } from "../../tests/helpers.js";
import type { TmpRoot } from "../../tests/helpers.js";
import type { Card } from "../../src/cards/types.js";

interface SuiteFixture {
  files: Record<string, string>;
  cards: { customId: string; targets: string[]; acceptance: string }[];
  vitest: Record<string, string>;
}
const fx = (): SuiteFixture => fixtureJson("cli/suiteNet.json") as SuiteFixture;
const SUITE = "node_modules/.bin/vitest run --reporter=dot";

function setup(vitest: string): { t: TmpRoot; cards: Card[] } {
  const f = fx();
  const t = tmpRoot();
  for (const [rel, text] of Object.entries(f.files)) t.write(rel, text);
  fs.chmodSync(t.write("node_modules/.bin/vitest", f.vitest[vitest]), 0o755);
  const cards = f.cards.map((c) => ({ ...c, intent: "generate", instruction: "x" }) as unknown as Card);
  return { t, cards };
}
const env = (): Record<string, string> => ({ PATH: process.env.PATH ?? "" });

test("Suite Net example 1: a red suite names its failing tests and the cards whose targets they import", async () => {
  const { t, cards } = setup("red");
  try {
    expect(await suiteNet(t.root, cards, env())).toStrictEqual({
      command: SUITE,
      ok: false,
      failing: ["tests/a.test.ts > A example 1: red", "tests/c.test.ts [ tests/c.test.ts ]"],
      cards: ["a", "c", "j"],
      log: " FAIL  tests/a.test.ts > A example 1: red\n FAIL  tests/a.test.ts > A example 1: red\n FAIL  tests/c.test.ts [ tests/c.test.ts ]\n",
    });
    expect(t.read("vitest.args")).toBe("run --reporter=dot\n");
  } finally {
    t.rm();
  }
});

test("Suite Net example 2: a green suite", async () => {
  const { t, cards } = setup("green");
  try {
    expect(await suiteNet(t.root, cards, env())).toStrictEqual({ command: SUITE, ok: true, failing: [], cards: [], log: "" });
    expect(t.read("vitest.args")).toBe("run --reporter=dot\n");
  } finally {
    t.rm();
  }
});

test("Suite Net example 3: no acceptance holds the related mark, nothing runs", async () => {
  const { t, cards } = setup("red");
  try {
    const plain = cards.map((c) => ({ ...c, acceptance: "exit 0" }));
    expect(await suiteNet(t.root, plain, env())).toBe(null);
    expect(t.exists("vitest.args")).toBe(false);
  } finally {
    t.rm();
  }
});

test("Suite Net example 4: a red exit with no FAIL line keeps the log tail", async () => {
  const { t, cards } = setup("broken");
  try {
    expect(await suiteNet(t.root, cards, env())).toStrictEqual({
      command: SUITE,
      ok: false,
      failing: [],
      cards: [],
      log: "Error: [vitest-worker]: Timeout calling onTaskUpdate\n Tests  3 passed (3)\n",
    });
  } finally {
    t.rm();
  }
});

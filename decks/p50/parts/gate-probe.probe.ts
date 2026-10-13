// P50 probe for gate-probe (src/gate/gateCommand.ts) — issue #50 F1: the gate names a probe it cannot build.
// Record gate/Gate Command example 6 (tests/fixtures/gate/gateCommand.json "probe") and example 5's "off" case
// (P22b, unchanged, green on the stub).
import { expect, test } from "vitest";
import { readDeckFile } from "../../src/cli/document.js";
import { checkBuilds } from "../../src/cli/checkBuilds.js";
import { gateCommand } from "../../src/gate/gateCommand.js";
import { fixtureJson, tmpRepo } from "../../tests/helpers.js";
import type { Card } from "../../src/cards/types.js";
import type { GateDeps } from "../../src/gate/gateCommand.js";
import type { TmpRepo } from "../../tests/helpers.js";

const result = (k: string): { code: number; document: unknown } =>
  (fixtureJson("gate/gateCommand.json") as Record<string, { code: number; document: unknown }>)[k];
const env = (): Record<string, string> => ({ PATH: process.env.PATH ?? "", HOME: process.env.HOME ?? "" });
const clock = (step: number): (() => number) => { let t = 0; return () => (t += step); };
const deps = (): GateDeps => ({ env: env(), now: clock(1000), readDeck: readDeckFile, builds: checkBuilds });
const card = (id: string, targets: string[], acceptance: string | null, dependsOn: string[] = []): Card => ({
  customId: id, intent: "generate", targets, contextSlice: [], instruction: "w", acceptance,
  model: null, maxTokens: null, reasoning: null, variants: 1, dependsOn,
});
function repo(files: Record<string, string>): TmpRepo {
  const r = tmpRepo();
  for (const [p, t] of Object.entries(files)) r.write(p, t);
  r.git(["add", "-A"]);
  r.git(["commit", "-q", "-m", "base"]);
  return r;
}
const deck = (cards: Card[]): string => JSON.stringify(cards) + "\n";

test("Gate Command example 6: a probe build error is named, code 2", async () => {
  const acc = "echo '== probe'\ngrep -q P1 src/p.txt || { echo \"probe/p/p.probe.ts(2,10): error TS2304: Cannot find name 'adaH'.\"; exit 1; }";
  const r = repo({
    "d.json": deck([card("p", ["src/p.txt"], acc)]),
    "s/src/p.txt": "s\n",
    "f/src/p.txt": "P1\n",
  });
  try {
    expect(await gateCommand(r.root, { deck: "d.json", stubs: "s", refs: "f" }, deps())).toStrictEqual(result("probe"));
  } finally {
    r.rm();
  }
});
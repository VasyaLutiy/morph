// P22a probe for gate-plan by docs/TASK_P22a_gate.md §2.2 (src/gate/gatePlan.ts) — the steps of a gate play: stub then
// reference per card, a retry of every card of a generation of two or more, the transaction's two rounds, missing files.
// Record Gate Plan examples 1-3, then rows.
import fs from "node:fs";
import { test, expect } from "vitest";
import { gatePlan } from "../../src/gate/gatePlan.js";
import type { GatePlan } from "../../src/gate/gatePlan.js";
import { loadDeck } from "../../src/cards/model.js";
import { layerGenerations } from "../../src/cards/layer.js";
import { TRANSACTION_MARK } from "../../src/cards/transaction.js";
import type { Card, Deck } from "../../src/cards/types.js";
import { fixtureJson, fixturePath } from "../../tests/helpers.js";

const plans = (k: string): GatePlan => (fixtureJson("gate/plans.json") as Record<string, GatePlan>)[k];
function deck(name: string): Deck { const d = loadDeck(fs.readFileSync(fixturePath("go-p7b/decks/b1/" + name), "utf8")); if (!d.ok) throw new Error(name); return d.deck; }
const all = (d: Deck): string[] => d.cards.flatMap((c) => c.targets).sort();
const card = (id: string, targets: string[], dependsOn: string[] = [], acceptance: string | null = "exit 1"): Card => ({ customId: id, intent: "generate", targets,
  contextSlice: [], instruction: "w", acceptance, model: null, maxTokens: null, reasoning: null, variants: 1, dependsOn });

test("Gate Plan example 1: the P21a cut, stub then reference per card, retries after each generation of two", () => {
  const d = deck("deck.p21.json");
  expect(gatePlan(d.cards, layerGenerations(d), all(d), all(d))).toStrictEqual(plans("p21"));
});

test("Gate Plan example 2: the transaction cut, every stub then every reference", () => {
  const d = deck("deck.p21c.json");
  expect(gatePlan(d.cards, layerGenerations(d), all(d), all(d))).toStrictEqual(plans("p21c"));
});

test("Gate Plan example 3: missing files stop the plan; unknown ids, empty generations and extra stubs", () => {
  const d = deck("deck.p21.json");
  expect(gatePlan(d.cards, layerGenerations(d), all(d).filter((t) => t !== "supervisor/guard.go"),
    all(d).filter((t) => t !== "daemon/daemon.go" && t !== "control/control.go"))).toStrictEqual(plans("missing"));
  const cards = [card("k", ["src/k.ts", "tests/k.test.ts"]), card("m", ["src/m.ts"], ["k"]), card("n", ["src/n.ts"], ["k"])];
  expect(gatePlan(cards, [["k", "zz"], [], ["m", "n"]], ["src/k.ts", "src/m.ts", "src/n.ts", "tests/k.test.ts", "extra.ts"],
    ["src/k.ts", "src/m.ts", "src/n.ts", "tests/k.test.ts"])).toStrictEqual(plans("small"));
});

test("rows: a shared target is put once in a transaction; one marked card makes the deck a transaction", () => {
  const cards = [card("a", ["x.ts", "y.ts"], [], TRANSACTION_MARK + "\nexit 0"), card("b", ["y.ts", "z.ts"], [], null)];
  const p = gatePlan(cards, [["b", "a"]], ["x.ts", "y.ts", "z.ts"], ["x.ts", "y.ts", "z.ts"]);
  expect(p.transaction).toBe(true);
  expect(p.steps.map((s) => s.phase + " " + s.card + " " + Object.keys(s.put).join(",") + " " + s.commit.join(","))).toStrictEqual([
    "stub b y.ts,z.ts,x.ts ", "stub a  ", "ref b y.ts,z.ts,x.ts ", "ref a  y.ts,z.ts,x.ts"]);
  const q = gatePlan([card("a", ["x.ts"]), card("b", ["y.ts"])], [["a", "b"]], ["x.ts"], []);
  expect(q).toStrictEqual({ transaction: false, steps: [], missing: ["no reference: x.ts", "no stub: y.ts", "no reference: y.ts"] });
});

// P1 probe for card-model: validateCard and loadDeck by docs/TASK_P1_cards.md §2.2, one test
// per record example, values and types. Runs from probe/card-model/ under vitest.
import { test, expect } from "vitest";
import { validateCard, loadDeck } from "../../src/cards/model.js";
import type { Card, CardResult, Deck, DeckResult, Fault } from "../../src/cards/types.js";
import { fixture, fixtureJson } from "../../tests/helpers.js";

function faultsOf(r: CardResult | DeckResult): Fault[] {
  if (r.ok) throw new Error("expected faults, got ok");
  return r.faults;
}
function cardOf(r: CardResult): Card {
  if (!r.ok) throw new Error("expected a Card, got faults: " + r.faults.map((f) => f.message).join("; "));
  return r.card;
}
function deckOf(r: DeckResult): Deck {
  if (!r.ok) throw new Error("expected a Deck, got faults: " + r.faults.map((f) => f.message).join("; "));
  return r.deck;
}
const lines = (fs: Fault[]): string => fs.map((f) => `${f.key}: ${f.message}`).join(" | ");

test("Validate Card example 1: minimal card gets the defaults", () => {
  const input = (fixtureJson("decks/tiny.json") as unknown[])[0];
  const c: Card = cardOf(validateCard(input));
  expect(`${c.customId} ${c.intent} ${JSON.stringify(c.targets)} ${c.instruction}`, "required keys")
    .toBe('a generate ["src/a.ts"] x');
  expect(JSON.stringify(c.contextSlice), "contextSlice []").toBe("[]");
  expect(c.variants, "variants 1").toBe(1);
  expect(JSON.stringify(c.dependsOn), "dependsOn []").toBe("[]");
  expect(`${c.acceptance} ${c.model} ${c.maxTokens} ${c.reasoning}`, "nullable defaults").toBe("null null null null");
  const keys: string = Object.keys(c).sort().join(",");
  expect(keys, "exactly the Card keys").toBe(
    "acceptance,contextSlice,customId,dependsOn,instruction,intent,maxTokens,model,reasoning,targets,variants");
});

test("Validate Card example 2: customId 'bad id'", () => {
  const f = faultsOf(validateCard(fixtureJson("cards/badId.json")));
  expect(lines(f), "one fault").toBe("customId: customId 'bad id' does not match ^[A-Za-z0-9._-]+$");
});

test("Validate Card example 3: three faults in key order", () => {
  const f = faultsOf(validateCard(fixtureJson("cards/threeFaults.json")));
  expect(f.map((x) => x.key).join(","), "keys in schema order").toBe("intent,targets,instruction");
  expect(lines(f), "messages").toBe(
    "intent: intent 'todo' is not generate|patch | targets: targets is empty | instruction: instruction is empty");
});

test("Validate Card example 4: targets repeat after normalisation", () => {
  const f = faultsOf(validateCard(fixtureJson("cards/repeatTarget.json")));
  expect(lines(f), "one fault").toBe("targets: targets repeat src/a.ts after normalisation");
});

test("Validate Card §2.2: unknown key, non-object, nullable keys, normalised paths", () => {
  const base = (fixtureJson("decks/tiny.json") as Record<string, unknown>[])[0];
  expect(lines(faultsOf(validateCard({ ...base, extra: 1 }))), "unknown key").toBe("extra: extra is not a Card key");
  expect(lines(faultsOf(validateCard(null))), "null").toBe("card: card is not an object");
  expect(lines(faultsOf(validateCard([base]))), "array").toBe("card: card is not an object");
  const c = cardOf(validateCard({ ...base, contextSlice: ["./docs/x.md"], acceptance: null, variants: 2,
    reasoning: { effort: "low" }, dependsOn: ["b"] }));
  expect(`${JSON.stringify(c.contextSlice)} ${c.acceptance} ${c.variants} ${JSON.stringify(c.reasoning)} ${JSON.stringify(c.dependsOn)}`,
    "normalised slice, explicit null, variants, reasoning, dependsOn").toBe('["docs/x.md"] null 2 {"effort":"low"} ["b"]');
  expect(lines(faultsOf(validateCard({ ...base, targets: ["../x.ts"], variants: 0 }))), "repo-relative and variants")
    .toBe("targets: targets '../x.ts' is not repo-relative | variants: variants is not an integer >= 1");
  expect(lines(faultsOf(validateCard({ intent: "generate", targets: ["src/a.ts"], instruction: "x" }))), "required")
    .toBe("customId: customId is required");
});

test("Load Deck example 1: duplicate customId b", () => {
  const f = faultsOf(loadDeck(fixture("decks/duplicate.json")));
  expect(lines(f), "one deck fault").toBe("cards[2].customId: duplicate customId b");
});

test("Load Deck example 2: the cycle a -> b -> a", () => {
  const f = faultsOf(loadDeck(fixture("decks/cycle.json")));
  expect(lines(f), "one deck fault").toBe("dependsOn: dependsOn cycle a -> b -> a");
});

test("Load Deck example 3: external dependsOn is allowed", () => {
  const d: Deck = deckOf(loadDeck(fixture("decks/external.json")));
  expect(`${d.cards.length} ${JSON.stringify(d.externalDependsOn)}`, "no fault, externalDependsOn").toBe('1 ["zzz"]');
  expect(JSON.stringify(d.cards[0]?.dependsOn), "the card keeps its dependsOn").toBe('["zzz"]');
});

test("Load Deck §2.2: not JSON, not an array, empty deck, element faults re-keyed", () => {
  const notJson = faultsOf(loadDeck("nope"));
  expect(`${notJson.length} ${notJson[0]?.key} ${notJson[0]?.message.startsWith("deck is not valid JSON: ")}`, "not JSON")
    .toBe("1 deck true");
  expect(lines(faultsOf(loadDeck("{}"))), "not an array").toBe("deck: deck is not a JSON array");
  const empty = deckOf(loadDeck("[]"));
  expect(`${empty.cards.length} ${empty.externalDependsOn.length}`, "empty deck").toBe("0 0");
  expect(lines(faultsOf(loadDeck("[" + fixture("cards/badId.json") + "]"))), "re-keyed")
    .toBe("cards[0].customId: customId 'bad id' does not match ^[A-Za-z0-9._-]+$");
  const layered = deckOf(loadDeck(fixture("decks/layered.json")));
  expect(layered.cards.map((c) => c.customId).join(","), "file order").toBe("a,b,c,d");
});

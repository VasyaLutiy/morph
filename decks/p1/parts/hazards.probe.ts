// P1 probe for hazards: findHazards by docs/TASK_P1_cards.md §2.2, one test per record example,
// values and types. Runs from probe/hazards/ under vitest.
import { test, expect } from "vitest";
import { findHazards } from "../../src/cards/hazards.js";
import { loadDeck } from "../../src/cards/model.js";
import type { Deck, Hazard, HazardKind, Severity } from "../../src/cards/types.js";
import { fixture } from "../../tests/helpers.js";

function deck(name: string): Deck {
  const r = loadDeck(fixture(`decks/${name}.json`));
  if (!r.ok) throw new Error(`${name}: ` + r.faults.map((f) => f.message).join("; "));
  return r.deck;
}
const line = (h: Hazard): string =>
  `${h.kind} ${h.severity} [${h.cards.join(",")}] ${h.path} ${JSON.stringify(h.repair)} ${h.bytes} ${h.cap}`;

test("Find Hazards example 1: write-write in one generation", () => {
  const got: Hazard[] = findHazards(deck("hazardsWriteWrite"));
  expect(got.map(line).join(" | "), "exactly one hazard").toBe("write-write error [a,b] src/x.ts null undefined undefined");
  const k: HazardKind = got[0]?.kind ?? "implicit-read";
  const s: Severity = got[0]?.severity ?? "warning";
  expect(`${k} ${s}`, "literal unions").toBe("write-write error");
});

test("Find Hazards example 2: read-write with a repair", () => {
  const got = findHazards(deck("hazardsReadWrite"));
  expect(got.map(line).join(" | "), "exactly one hazard")
    .toBe('read-write error [b,a] src/x.ts {"addDependsOn":{"card":"b","on":"a"}} undefined undefined');
});

test("Find Hazards §2.2: unordered-read and implicit-read are warnings", () => {
  expect(findHazards(deck("hazardsUnordered")).map(line).join(" | "), "unordered-read")
    .toBe("unordered-read warning [a,b] src/b.ts null undefined undefined");
  expect(findHazards(deck("tiny")).map(line).join(" | "), "implicit-read")
    .toBe("implicit-read warning [a] null null undefined undefined");
  expect(findHazards(deck("layered")).map((h) => h.kind).join(","), "layered: four implicit-read, nothing else")
    .toBe("implicit-read,implicit-read,implicit-read,implicit-read");
});

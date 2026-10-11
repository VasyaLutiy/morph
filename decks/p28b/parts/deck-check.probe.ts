// P28b probe for deck-check by docs/TASK_P28b_unproven.md §2.2 (src/cli/deckCheck.ts, src/cli/types.ts) — issue #22 M3:
// deck check lists, as warnings, the targets its build proved nothing about. Record Deck Check example 7; its third
// call (a plain deck without _stubs/) is main's document, green on main by design. The document is read as unknown.
import { test, expect } from "vitest";
import { deckCheckCommand } from "../../src/cli/deckCheck.js";
import { fixtureJson, tmpRoot } from "../../tests/helpers.js";

test("Deck Check example 7: unproven targets are the last key and count as warnings; the exit is unchanged; a plain deck without stubs is as before", () => {
  const r = tmpRoot("morph-unproven-");
  try {
    for (const [p, t] of Object.entries(fixtureJson("cli/unproven.json") as Record<string, string>)) r.write(p, t);
    const want = fixtureJson("cli/deckCheck.unproven.json") as Record<string, Record<string, unknown>>;
    const env = { PATH: process.env.PATH ?? "" };
    const got: Record<string, unknown> = {};
    const lastKeys: Record<string, string | undefined> = {};
    const codes: Record<string, number> = {};
    for (const d of ["u", "q", "t"]) {
      const result = deckCheckCommand(r.root, "decks/" + d + "/deck.json", 500000, env);
      const doc = result.document as Record<string, unknown>;
      got[d] = doc;
      lastKeys[d] = Object.keys(doc).pop();
      codes[d] = result.code;
    }
    expect({ got, lastKeys, codes }).toStrictEqual({
      got: { u: want.u, q: want.q, t: want.t },
      lastKeys: { u: "weights", q: "unproven", t: "unproven" },
      codes: { u: 0, q: 0, t: 0 },
    });
  } finally {
    r.rm();
  }
}, 120000);

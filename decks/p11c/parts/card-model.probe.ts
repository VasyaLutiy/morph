// P11c probe for card-model by docs/TASK_P11c_runner.md §2.2 (issue #5 findings 3 and 9) — a customId ending in
// ".r<digits>" is refused (it collides with its own retry id), and ".." (after normalisation) is not repo-relative in
// targets and contextSlice. Record Validate Card examples 5-6, then the §2.2 rows.
import { test, expect } from "vitest";
import { loadDeck, validateCard } from "../../src/cards/model.js";

const faultsOf = (input: unknown): string => {
  const r = validateCard(input);
  return r.ok ? "ok" : r.faults.map((f) => `${f.key}: ${f.message}`).join(" | ");
};
const base = { intent: "generate", targets: ["src/a.ts"], instruction: "x" };

test("Validate Card example 5: a customId ending in .r<n> is refused", () => {
  expect(faultsOf({ customId: "lint.r2", ...base })).toBe("customId: customId 'lint.r2' ends in .r<n>, the suffix of a retry");
});

test("Validate Card example 6: '..' is not repo-relative", () => {
  expect(faultsOf({ customId: "a", intent: "patch", targets: [".."], contextSlice: ["..", "docs/x.md"], instruction: "x" }))
    .toBe("targets: targets '..' is not repo-relative | contextSlice: contextSlice '..' is not repo-relative");
});

test("§2.2 rows: the suffix rule exactly; '..' after normalisation; through Load Deck", () => {
  const ids = ["a.r10", "a.r", "a.r1x", "a.rr1", "a-r1", "r1", "x.R1", "a.r1.v1", "deck.r0"];
  expect(ids.map((customId) => (validateCard({ customId, ...base }).ok ? "ok" : "fault")).join(","), ids.join(","))
    .toBe("fault,ok,ok,ok,ok,ok,ok,ok,fault");
  expect(faultsOf({ customId: "b", ...base, targets: ["src/../.."] }), "normalised to ..").toBe("targets: targets '..' is not repo-relative");
  expect(faultsOf({ customId: "c", ...base, targets: ["../x.ts", "..x/y.ts", "a/..b"] }), "../ was refused before; ..x is a name")
    .toBe("targets: targets '../x.ts' is not repo-relative");
  const deck = loadDeck(JSON.stringify([{ customId: "fmt.r1", ...base }]));
  expect(deck.ok ? "ok" : deck.faults.map((f) => `${f.key}: ${f.message}`).join(" | "), "Load Deck")
    .toBe("cards[0].customId: customId 'fmt.r1' ends in .r<n>, the suffix of a retry");
});

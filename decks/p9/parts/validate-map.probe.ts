// P9 probe for validate-map: validateMap by docs/TASK_P9_contour.md §2.2, one test per record example
// (Component contour, Validate Map 1-4), then the §2.2 rows and the types.
import { test, expect, expectTypeOf } from "vitest";
import { CARD_KEYS, EXTRA_KEYS, MAP_KEYS, validateMap } from "../../src/contour/map.js";
import type { ContourMap, MapResult } from "../../src/contour/types.js";
import { fixtureJson } from "../../tests/helpers.js";

const problems = (r: MapResult): string[] => (r.ok ? [] : r.problems);
const NULLS = { customId: null, intent: null, targets: null, contextSlice: null, dependsOn: null, instruction: null,
  acceptance: null, model: null, maxTokens: null, reasoningMaxTokens: null, variants: null };

test("Validate Map example 1: the mini map", () => {
  expect(validateMap(fixtureJson("contour/mini.map.json"))).toStrictEqual({ ok: true, map: fixtureJson("contour/mini.map.typed.json") });
});

test("Validate Map example 2: the bad map, 15 problems in order", () => {
  expect(validateMap(fixtureJson("contour/badMap.json"))).toStrictEqual({ ok: false, problems: fixtureJson("contour/badMap.problems.json") });
});

test("Validate Map example 3: the empty map; not an object", () => {
  expect(validateMap({})).toStrictEqual({ ok: true, map: { version: 1, package: null, language: null, docs: [], groups: [], cards: [], extraCards: [] } });
  expect(validateMap([])).toStrictEqual({ ok: false, problems: ["(root): a map must be an object"] });
});

test("Validate Map example 4: an empty depends_on is allowed, an empty slice path is not", () => {
  expect(validateMap({ groups: { g: ["A"] }, cards: { g: { depends_on: [], context_slice: [""] } } }))
    .toStrictEqual({ ok: false, problems: ["cards.g.context_slice[0]: must be a non-empty string"] });
});

test("§2.2: values verbatim, every field typed, key order", () => {
  const r = validateMap({ version: 1, package: " src ", docs: [" d.md "], cards: { a: { custom_id: "a.b-c_1", intent: "patch", targets: [" x.ts "],
    model: " m ", max_tokens: 5, reasoning_max_tokens: 2, variants: 3, acceptance: "\nexit 0\n", instruction: " do " } } });
  expect(r).toStrictEqual({ ok: true, map: { version: 1, package: " src ", language: null, docs: [" d.md "], groups: [], cards: [{ id: "a",
    customId: "a.b-c_1", intent: "patch", targets: [" x.ts "], contextSlice: null, dependsOn: null, instruction: " do ", acceptance: "\nexit 0\n",
    model: " m ", maxTokens: 5, reasoningMaxTokens: 2, variants: 3 }], extraCards: [] } });
  expect(r.ok ? Object.keys(r.map.cards[0] ?? {}).join(",") : "").toBe(
    "id,customId,intent,targets,contextSlice,dependsOn,instruction,acceptance,model,maxTokens,reasoningMaxTokens,variants");
  expect(r.ok ? Object.keys(r.map).join(",") : "").toBe("version,package,language,docs,groups,cards,extraCards");
});

test("§2.2: card values, containers and numbers", () => {
  expect(problems(validateMap({ language: 3, docs: ["a", ""], groups: [], cards: { a: { targets: "x", context_slice: [1], instruction: "  ",
    acceptance: 0, model: "", max_tokens: -1, reasoning_max_tokens: "2", variants: 0, intent: "generate" } } }))).toStrictEqual([
    "language: must be a non-empty string",
    "docs[1]: must be a non-empty string",
    "groups: must be an object",
    "cards.a.targets: must be a list",
    "cards.a.context_slice[0]: must be a non-empty string",
    "cards.a.instruction: must be a non-empty string",
    "cards.a.acceptance: must be a non-empty string",
    "cards.a.model: must be a non-empty string",
    "cards.a.max_tokens: must be a positive integer",
    "cards.a.reasoning_max_tokens: must be a positive integer",
    "cards.a.variants: must be a positive integer",
  ]);
  expect(problems(validateMap({ cards: [], extra_cards: {} }))).toStrictEqual(["cards: must be an object", "extra_cards: must be a list"]);
  expect(problems(validateMap({ groups: { a: "F", b: ["F", ""], c: ["F"] } }))).toStrictEqual([
    "groups.a: must be a non-empty list of Function names", "groups.b[1]: must be a non-empty string",
    "groups.c[0]: Function 'F' is already in group 'b'"]);
});

test("§2.2: extra cards — required first, then unknown keys, then component and fields", () => {
  expect(problems(validateMap({ extra_cards: [{ x: 1, component: "", depends_on: "a" }, "y", { custom_id: "e", targets: ["e.ts"], instruction: "I" }] })))
    .toStrictEqual([
      "extra_cards[0].custom_id: required", "extra_cards[0].targets: required", "extra_cards[0].instruction: required",
      `extra_cards[0]: unknown key 'x' (known: ${["component", ...CARD_KEYS].join(", ")})`,
      "extra_cards[0].component: must be a non-empty string", "extra_cards[0].depends_on: must be a list",
      "extra_cards[1]: must be an object"]);
  expect(validateMap({ extra_cards: [{ custom_id: "e", targets: ["e.ts"], instruction: "I" }] })).toStrictEqual({ ok: true, map: {
    version: 1, package: null, language: null, docs: [], groups: [], cards: [], extraCards: [{ component: null, ...NULLS, customId: "e",
      targets: ["e.ts"], instruction: "I" }] } });
});

test("§2.2: the types and the key tables", () => {
  expectTypeOf(validateMap).toEqualTypeOf<(doc: unknown) => MapResult>();
  expectTypeOf<Extract<MapResult, { ok: true }>["map"]>().toEqualTypeOf<ContourMap>();
  expect([...MAP_KEYS]).toStrictEqual(["version", "package", "language", "docs", "groups", "cards", "extra_cards"]);
  expect([...CARD_KEYS]).toStrictEqual(["custom_id", "intent", "targets", "context_slice", "depends_on", "instruction", "acceptance",
    "model", "max_tokens", "reasoning_max_tokens", "variants"]);
  expect([...EXTRA_KEYS]).toStrictEqual(["component", ...CARD_KEYS]);
});

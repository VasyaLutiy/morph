import { test, expect } from "vitest";
import { validateMap } from "../../src/contour/map.js";
import { fixtureJson } from "../helpers.js";
import type { ContourMap } from "../../src/contour/types.js";

test("Validate Map example 1: the mini map is typed whole", () => {
  expect(validateMap(fixtureJson("contour/mini.map.json"))).toStrictEqual({
    ok: true,
    map: fixtureJson("contour/mini.map.typed.json"),
  });
  const r = validateMap(fixtureJson("contour/mini.map.json"));
  if (r.ok) {
    const card = r.map.cards.find((c) => c.acceptance !== null);
    expect(card === undefined ? null : card.acceptance).toContain("exit 0\n");
  } else {
    expect.unreachable();
  }
});

test("Validate Map example 2: the bad map has the 15 problems in order", () => {
  expect(validateMap(fixtureJson("contour/badMap.json"))).toStrictEqual({
    ok: false,
    problems: fixtureJson("contour/badMap.problems.json"),
  });
  const r = validateMap(fixtureJson("contour/badMap.json"));
  if (r.ok) {
    expect.unreachable();
  } else {
    const problems = fixtureJson("contour/badMap.problems.json") as string[];
    expect(problems).toContain("groups.b[0]: Function 'G' is already in group 'a'");
    expect(problems).toContain("cards.x.custom_id: must match ^[A-Za-z0-9._-]+$");
    expect(r.problems.join("\n")).toBe(problems.join("\n"));
  }
});

test("Validate Map example 3: the empty object and a non-object root", () => {
  expect(validateMap({})).toStrictEqual({
    ok: true,
    map: {
      version: 1,
      package: null,
      language: null,
      docs: [],
      groups: [],
      cards: [],
      extraCards: [],
    },
  });
  expect(validateMap([])).toStrictEqual({
    ok: false,
    problems: ["(root): a map must be an object"],
  });
});

test("Validate Map example 4: an empty depends_on is allowed, an empty context_slice item is not", () => {
  expect(
    validateMap({ groups: { g: ["A"] }, cards: { g: { depends_on: [], context_slice: [""] } } }),
  ).toStrictEqual({
    ok: false,
    problems: ["cards.g.context_slice[0]: must be a non-empty string"],
  });
});

test("Validate Map: map values are kept verbatim, never trimmed", () => {
  const r = validateMap({ package: " p ", language: " ts " });
  expect(r).toStrictEqual({
    ok: true,
    map: {
      version: 1,
      package: " p ",
      language: " ts ",
      docs: [],
      groups: [],
      cards: [],
      extraCards: [],
    },
  });
});

test("Validate Map: reasoning_max_tokens must be a positive integer", () => {
  const doc = { cards: { x: { reasoning_max_tokens: 1.5 } } };
  expect(validateMap(doc)).toStrictEqual({
    ok: false,
    problems: ["cards.x.reasoning_max_tokens: must be a positive integer"],
  });
});

test("Validate Map: model is a non-empty string, stored when valid", () => {
  expect(validateMap({ cards: { x: { model: "" } } })).toStrictEqual({
    ok: false,
    problems: ["cards.x.model: must be a non-empty string"],
  });
  const r = validateMap({ cards: { x: { model: "glm" } } });
  if (r.ok) {
    expect(r.map.cards[0].model).toBe("glm");
  } else {
    expect.unreachable();
  }
});

test("Validate Map: an extra card's component is optional and kept verbatim", () => {
  const r = validateMap({
    extra_cards: [
      { custom_id: "e1", targets: ["a.ts"], instruction: "do", component: " cards " },
      { custom_id: "e2", targets: ["b.ts"], instruction: "do" },
    ],
  });
  if (r.ok) {
    const map: ContourMap = r.map;
    expect(map.extraCards[0].component).toBe(" cards ");
    expect(map.extraCards[1].component).toBe(null);
  } else {
    expect.unreachable();
  }
});

test("Validate Map: groups that is not an object", () => {
  expect(validateMap({ groups: ["a"] })).toStrictEqual({
    ok: false,
    problems: ["groups: must be an object"],
  });
});

test("Validate Map: version '1' is not 1", () => {
  expect(validateMap({ version: "1" })).toStrictEqual({
    ok: false,
    problems: ["version: must be 1"],
  });
});

test("Validate Map: empty targets must hold at least one path", () => {
  expect(validateMap({ cards: { x: { targets: [] } } })).toStrictEqual({
    ok: false,
    problems: ["cards.x.targets: must hold at least one path"],
  });
});

test("Validate Map: an unknown root key names the whole table", () => {
  expect(validateMap({ extra: 1 })).toStrictEqual({
    ok: false,
    problems: [
      "(root): unknown key 'extra' (known: version, package, language, docs, groups, cards, extra_cards)",
    ],
  });
});

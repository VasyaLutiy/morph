import { expect, test } from "vitest";
import {
  DEFAULT_LANGUAGE,
  PROFILES,
  fillTemplate,
  resolveProfile,
} from "../../src/language/profiles.js";
import type { LanguageProfile } from "../../src/language/types.js";
import { fixtureJson } from "../helpers.js";

const TS = PROFILES[0] as LanguageProfile;

test("Resolve Profile example 1: null component and null map give the typescript profile (the fixture)", () => {
  expect(resolveProfile(null, null)).toStrictEqual({
    ok: true,
    profile: fixtureJson("language/typescript.json"),
  });
});

test("Resolve Profile example 2: component ' Python ' wins over map 'typescript', trimmed and lower-cased", () => {
  expect(resolveProfile(" Python ", "typescript")).toStrictEqual({
    ok: true,
    profile: fixtureJson("language/python.json"),
  });
});

test("Resolve Profile example 3: empty component value falls through to the map", () => {
  const got = resolveProfile("", "python");
  expect(got.ok ? got.profile.id : got.error).toBe("python");
});

test("Resolve Profile example 4: unknown component language 'go' is an error naming the known languages", () => {
  expect(resolveProfile("go", "python")).toStrictEqual({
    ok: false,
    error: "unknown language 'go' (known: typescript, python)",
  });
});

test("Fill Template example 1: code target template with component and name", () => {
  expect(fillTemplate("tests/{component}/{name}.test.ts", { component: "cli", name: "parseCommand" })).toBe(
    "tests/cli/parseCommand.test.ts",
  );
});

test("Fill Template example 2: every occurrence filled with the literal value, unknown key kept", () => {
  expect(fillTemplate("{a}-{a}-{c}", { a: "$&" })).toBe("$&-$&-{c}");
});

test("Fill Template example 3: one pass, a value is not expanded again", () => {
  expect(fillTemplate("{a}{b}", { a: "{b}", b: "x" })).toBe("{b}x");
});

test("resolveProfile returns the registry object itself, not a copy", () => {
  const got = resolveProfile("typescript", null);
  expect(got.ok && got.profile === TS).toBe(true);
});

test("resolveProfile: component value wins even when the map's value is unknown", () => {
  const got = resolveProfile("TypeScript", "go");
  expect(got.ok ? got.profile.id : got.error).toBe("typescript");
});

test("resolveProfile: a whitespace-only component value is reported untrimmed", () => {
  expect(resolveProfile("  ", "typescript")).toStrictEqual({
    ok: false,
    error: "unknown language '  ' (known: typescript, python)",
  });
});

test("resolveProfile: a map value is used only when the component value is null or empty", () => {
  const got = resolveProfile(null, "  python  ");
  expect(got.ok ? got.profile.id : got.error).toBe("python");
});

test("resolveProfile: the default language is typescript", () => {
  expect(DEFAULT_LANGUAGE).toBe("typescript");
});

test("fillTemplate: keys are letters only, so {a1}, { a} and {} stay; an inherited key stays", () => {
  expect(fillTemplate("{a1}-{ a}-{}-{toString}-y", { a: "x" })).toBe("{a1}-{ a}-{}-{toString}-y");
});

test("fillTemplate: with no matching keys the template is unchanged", () => {
  expect(fillTemplate("no placeholders here", {})).toBe("no placeholders here");
});

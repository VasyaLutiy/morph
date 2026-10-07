// P8 probe for profiles: the registry, resolveProfile and fillTemplate by docs/TASK_P8_language.md §2.2,
// one test per record example (Component language, Resolve Profile 1-4, Fill Template 1-3), then the
// §2.2 rows and the types.
import { test, expect, expectTypeOf } from "vitest";
import { PROFILES, DEFAULT_LANGUAGE, resolveProfile, fillTemplate } from "../../src/language/profiles.js";
import type { LanguageProfile, ProfileResult } from "../../src/language/types.js";
import { fixtureJson } from "../../tests/helpers.js";

test("Resolve Profile example 1: nothing given is the typescript profile", () => {
  expect(resolveProfile(null, null)).toStrictEqual({ ok: true, profile: fixtureJson("language/typescript.json") });
});

test("Resolve Profile example 2: the component wins, trimmed and lower-cased", () => {
  expect(resolveProfile(" Python ", "typescript")).toStrictEqual({ ok: true, profile: fixtureJson("language/python.json") });
});

test("Resolve Profile example 3: an empty component value falls through to the map", () => {
  const got = resolveProfile("", "python");
  expect(got.ok ? got.profile.id : got.error).toBe("python");
});

test("Resolve Profile example 4: an unknown language names the known ones", () => {
  expect(resolveProfile("go", "python")).toStrictEqual({ ok: false, error: "unknown language 'go' (known: typescript, python)" });
});

test("Fill Template example 1: placeholders replaced", () => {
  expect(fillTemplate("tests/{component}/{name}.test.ts", { component: "cli", name: "parseCommand" }))
    .toBe("tests/cli/parseCommand.test.ts");
});

test("Fill Template example 2: every occurrence, the value literal, an unknown key kept", () => {
  expect(fillTemplate("{a}-{a}-{c}", { a: "$&" })).toBe("$&-$&-{c}");
});

test("Fill Template example 3: one pass", () => {
  expect(fillTemplate("{a}{b}", { a: "{b}", b: "x" })).toBe("{b}x");
});

test("§2.2: PROFILES is typescript then python, each equal to its fixture; DEFAULT_LANGUAGE", () => {
  expect(PROFILES.map((p) => p.id).join(",")).toBe("typescript,python");
  expect(PROFILES[0]).toStrictEqual(fixtureJson("language/typescript.json"));
  expect(PROFILES[1]).toStrictEqual(fixtureJson("language/python.json"));
  expect(Object.keys(PROFILES[0] as object).join(",")).toBe(Object.keys(fixtureJson("language/typescript.json") as object).join(","));
  expect(DEFAULT_LANGUAGE).toBe("typescript");
});

test("§2.2: the registry object itself is returned", () => {
  const a = resolveProfile(null, null);
  const b = resolveProfile("python", null);
  expect(a.ok && a.profile === PROFILES[0]).toBe(true);
  expect(b.ok && b.profile === PROFILES[1]).toBe(true);
});

test("§2.2: the choice order and the error quoting the choice as given", () => {
  expect(resolveProfile("TypeScript", "go").ok).toBe(true);
  const ws = resolveProfile("  ", "python");
  expect(ws.ok ? "ok" : ws.error).toBe("unknown language '  ' (known: typescript, python)");
  const m = resolveProfile(null, "Rust");
  expect(m.ok ? "ok" : m.error).toBe("unknown language 'Rust' (known: typescript, python)");
  const e = resolveProfile(null, "");
  expect(e.ok ? e.profile.id : e.error).toBe("typescript");
  const p = resolveProfile(null, "PYTHON");
  expect(p.ok ? p.profile.id : p.error).toBe("python");
});

test("§2.2: fillTemplate keys are letters only and own properties", () => {
  expect(fillTemplate("{a1}{toString}{ a}{}", { a1: "x", a: "y" })).toBe("{a1}{toString}{ a}{}");
  expect(fillTemplate("$1 {x} $$", { x: "$1$$" })).toBe("$1 $1$$ $$");
  expect(fillTemplate("", { a: "b" })).toBe("");
});

test("§2.2: the types", () => {
  expectTypeOf(resolveProfile).toEqualTypeOf<(componentLanguage: string | null, mapLanguage: string | null) => ProfileResult>();
  expectTypeOf(fillTemplate).toEqualTypeOf<(template: string, values: Record<string, string>) => string>();
  expectTypeOf(PROFILES).toEqualTypeOf<readonly LanguageProfile[]>();
  expectTypeOf<LanguageProfile["id"]>().toEqualTypeOf<"typescript" | "python">();
  expectTypeOf<LanguageProfile["nameCase"]>().toEqualTypeOf<"camel" | "snake">();
  expectTypeOf<LanguageProfile["parseTakesFiles"]>().toEqualTypeOf<boolean>();
});

// P31a probe for canonical-guardrail by docs/TASK_P31a_guardrails.md §2.2 (src/language/guardrails.ts) — issue #42:
// the binary's own table of canonical Guardrail names per language. Record Canonical Guardrail examples 1-3.
import { test, expect } from "vitest";
import { GUARDRAIL_RULES, guardrailKey, guardrailRule } from "../../src/language/guardrails.js";
import { GO, PYTHON, TYPESCRIPT } from "../../src/language/profiles.js";

test("Canonical Guardrail example 1: the key is trimmed, lower-cased, whitespace runs one space", () => {
  expect(guardrailKey("  No   Shell ")).toBe("no shell");
  expect(guardrailKey("STDLIB\tOnly")).toBe("stdlib only");
  expect(guardrailKey("No-Shell")).toBe("no-shell");
});

test("Canonical Guardrail example 2: a rule per language, an unknown name null", () => {
  expect(guardrailRule(TYPESCRIPT, "No Process")).toBe("no-process");
  expect(guardrailRule(GO, "No Process")).toBe(null);
  expect(guardrailRule(GO, " pure ")).toBe("pure");
  expect(guardrailRule(GO, "no network")).toBe("no-network");
  expect(guardrailRule(GO, "Stdlib Only")).toBe("stdlib-only");
  expect(guardrailRule(GO, "Interfaces Share One Core")).toBe(null);
  expect(guardrailRule(GO, "Standard Library Only")).toBe(null);
  expect(guardrailRule(PYTHON, "No Shell")).toBe(null);
  expect(guardrailRule(TYPESCRIPT, "constructor")).toBe(null);
});

test("Canonical Guardrail example 3: the whole table", () => {
  expect(GUARDRAIL_RULES).toStrictEqual({
    typescript: { "no shell": "no-shell", "no clock": "no-clock", "no network": "no-network", "no env": "no-env",
      "no process": "no-process", "stdlib only": "stdlib-only", pure: "pure" },
    python: {},
    go: { "no shell": "no-shell", "no clock": "no-clock", "no network": "no-network", "no env": "no-env",
      "stdlib only": "stdlib-only", pure: "pure" },
  });
  expect(Object.keys(GUARDRAIL_RULES)).toStrictEqual(["typescript", "python", "go"]);
});

// P15 probe for profiles by docs/TASK_P15_golang.md §2.2 (src/language/types.ts, profiles.ts) — the go profile, the
// registry of three, the known-language list; then the go profile through the unchanged language functions (names,
// paths, detection, acceptance lines, the judge instruction). Record Resolve Profile examples 4 (changed) and 5, then
// the §2.2 rows.
import { test, expect } from "vitest";
import { DEFAULT_LANGUAGE, GO, PROFILES, PYTHON, TYPESCRIPT, resolveProfile } from "../../src/language/profiles.js";
import { cutTargets } from "../../src/language/naming.js";
import { codeTargets, isTest, profileForPath, testTarget } from "../../src/language/paths.js";
import { acceptanceLines, judgeInstruction } from "../../src/language/template.js";
import type { LanguageProfile, ProfileId } from "../../src/language/types.js";
import { fixtureJson } from "../../tests/helpers.js";

const goId: ProfileId = "go";

test("Resolve Profile examples 4 and 5: rust is unknown among three; Go resolves to the go profile, the fixture", () => {
  expect(resolveProfile("rust", "python")).toStrictEqual({ ok: false, error: "unknown language 'rust' (known: typescript, python, go)" });
  expect(resolveProfile("Go", null)).toStrictEqual({ ok: true, profile: fixtureJson("language/go.json") });
  const r = resolveProfile(" GO ", "typescript");
  expect(r.ok && r.profile, "the registry object itself").toBe(GO);
});

test("the registry: typescript, python, go in that order; the other two profiles and the default unchanged", () => {
  expect(PROFILES.map((p) => p.id)).toStrictEqual(["typescript", "python", goId]);
  expect(PROFILES[2]).toBe(GO);
  expect(GO as unknown).toStrictEqual(fixtureJson("language/go.json"));
  expect(TYPESCRIPT as unknown).toStrictEqual(fixtureJson("language/typescript.json"));
  expect(PYTHON as unknown).toStrictEqual(fixtureJson("language/python.json"));
  expect(DEFAULT_LANGUAGE).toBe("typescript");
  expect(resolveProfile("  ", null)).toStrictEqual({ ok: false, error: "unknown language '  ' (known: typescript, python, go)" });
  expect(resolveProfile(null, "cobol")).toStrictEqual({ ok: false, error: "unknown language 'cobol' (known: typescript, python, go)" });
  const r = resolveProfile("", "go");
  expect(r.ok ? r.profile.id : r.error).toBe("go");
});

test("the go profile through names and paths: snake files next to the code, tests by *_test.go only", () => {
  const p: LanguageProfile = GO;
  expect(cutTargets(p, "calc", "Clamp Value")).toStrictEqual({ ok: true, slug: "clamp-value",
    targets: { code: "calc/clamp_value.go", test: "calc/clamp_value_test.go", judge: "calc/clamp_value_examples_test.go" } });
  expect(cutTargets(p, "Run Loop", "Send HTTP (v2)")).toStrictEqual({ ok: true, slug: "send-http-v2",
    targets: { code: "run_loop/send_http_v2.go", test: "run_loop/send_http_v2_test.go", judge: "run_loop/send_http_v2_examples_test.go" } });
  expect(["calc/a_test.go", "tests/a.go", "testdata/x_test.go", "calc/a.go", "a_test.go.txt"].map((x) => isTest(p, x)))
    .toStrictEqual([true, false, true, false, false]);
  expect(codeTargets(p, ["calc/a.go", "calc/a_test.go", "go.mod", "x/B.GO"])).toStrictEqual(["calc/a.go", "x/B.GO"]);
  expect(testTarget(p, ["calc/a.go", "calc/a_test.go"])).toBe("calc/a_test.go");
  expect(["x/y.GO", "go.mod", "a.ts"].map((x) => profileForPath(x)?.id ?? null)).toStrictEqual(["go", null, "typescript"]);
});

test("the go profile's lines and judge instruction", () => {
  expect(acceptanceLines(GO, ["report/f.go", "report/f_test.go", "README.md"])).toStrictEqual([
    "go build ./...", "go vet ./...", "go test -count=1 ./$(dirname report/f_test.go)/", "go test -count=1 ./..."]);
  expect(acceptanceLines(GO, ["docs/x.md"])).toStrictEqual(["go test -count=1 ./..."]);
  const j = judgeInstruction(GO, { test: "calc/a_examples_test.go", module: "calc/a.go", docs: ["docs/T.md"] });
  expect(j.startsWith("Write ONLY the test file `calc/a_examples_test.go`: one `func Test<Function>Example<n>(t *testing.T)` per example of `calc/a.go` taken from docs/T.md, this instruction, in example order")).toBe(true);
  expect(j.includes("{")).toBe(false);
  expect(GO.helpersModule).toBe("internal/testhelp/testhelp.go");
});

// P10b probe for steps: heredoc, snapshotLines, wrapScript, tscStep, eslintStep, ESLINT_VERDICT, vitestStep,
// fullArgs, frozenStep, untrackedStep, OWN_GIT_BEFORE, OWN_GIT_AFTER, namesKept by docs/TASK_P10b_builder.md §2.2,
// one test per record example (Component builder: Wrap Script 1-2, Check Steps 1-3, Tree Steps 1-3), then the
// §2.2 rows and the types. Every expected text is build.py's own (tests/fixtures/builder/, written from its functions).
import { test, expect, expectTypeOf } from "vitest";
import {
  ESLINT_VERDICT, OWN_GIT_AFTER, OWN_GIT_BEFORE, eslintStep, frozenStep, fullArgs, heredoc, namesKept, snapshotLines,
  tscStep, untrackedStep, vitestStep, wrapScript,
} from "../../src/builder/steps.js";
import { PYTHON, TYPESCRIPT } from "../../src/language/profiles.js";
import type { LanguageProfile } from "../../src/language/types.js";
import { fixture } from "../../tests/helpers.js";

test("Wrap Script example 1: heredoc drops the trailing blank lines", () => {
  expect(heredoc("$P/x.json", "[1]\n\n", "MORPH_X_EOF")).toBe("cat > $P/x.json <<'MORPH_X_EOF'\n[1]\nMORPH_X_EOF\n");
});

test("Wrap Script example 2: the whole frame, .txt for a target without an extension", () => {
  expect(wrapScript("c", "p1", ["src/a.ts", "Makefile"], "echo hi\n")).toBe(fixture("builder/wrap.txt"));
});

test("Check Steps example 1: tsc and eslint lines from the typescript profile", () => {
  expect(tscStep(TYPESCRIPT)).toBe("echo '== tsc'; node_modules/.bin/tsc --noEmit -p $P/tsconfig.card.json\n");
  expect(eslintStep(TYPESCRIPT, ["src/a.ts", "tests/a.test.ts"]))
    .toBe("echo '== eslint'; E=0; node_modules/.bin/eslint src/a.ts tests/a.test.ts || E=1\n");
});

test("Check Steps example 2: fullArgs", () => {
  expect(fullArgs([])).toBe("--passWithNoTests");
  expect(fullArgs(["tests/x.test.ts", "tests/y.test.ts"]))
    .toBe("--passWithNoTests --exclude tests/x.test.ts --exclude tests/y.test.ts");
});

test("Check Steps example 3: a vitest step with the full failure report and the locator", () => {
  expect(vitestStep(TYPESCRIPT, "tests/a.test.ts")).toBe(fixture("builder/vitestStep.txt"));
});

test("Tree Steps example 1: frozen and untracked", () => {
  expect(frozenStep(["docs", "decks"])).toBe(fixture("builder/frozen.txt"));
  expect(untrackedStep(["src/a.ts", "src/b.ts"])).toBe(fixture("builder/untracked.txt"));
});

test("Tree Steps example 2: names kept, one dropped name", () => {
  expect(namesKept("tests/a.examples.test.ts", ["A example 4: old"]) + namesKept("tests/b.examples.test.ts", []))
    .toBe(fixture("builder/names.txt"));
});

test("Tree Steps example 3: own git before and after", () => {
  expect(OWN_GIT_BEFORE + OWN_GIT_AFTER).toBe(fixture("builder/ownGit.txt"));
});

test("§2.2 ESLINT_VERDICT and the own-git lines are single lines with a newline", () => {
  expect(ESLINT_VERDICT)
    .toBe('[ "$E" = 0 ] || { echo "== eslint failed (see above); every step between it and here passed"; exit 1; }\n');
  expect(OWN_GIT_BEFORE.split("\n")).toHaveLength(2);
  expect(OWN_GIT_AFTER.startsWith("echo '== own git'; G1=$( ")).toBe(true);
});

test("§2.2 snapshotLines alone; heredoc trims spaces too", () => {
  expect(snapshotLines("j", "p9", ["tests/a.examples.test.ts"]))
    .toBe("D=/tmp/morph/j-p9; mkdir -p $D; S=$(date +%s)-$$; L=$D/acc-$S.log\ncp tests/a.examples.test.ts $D/0-$S.ts 2>/dev/null\n");
  expect(snapshotLines("j", "p9", [])).toBe("D=/tmp/morph/j-p9; mkdir -p $D; S=$(date +%s)-$$; L=$D/acc-$S.log\n");
  expect(heredoc("f", "a  \n\t\n", "T")).toBe("cat > f <<'T'\na\nT\n");
});

test("§2.2 the lines come from the profile given", () => {
  expect(eslintStep(PYTHON, ["a.py"])).toBe("echo '== eslint'; E=0; ruff check a.py || E=1\n");
  expect(tscStep(PYTHON)).toBe("echo '== tsc'; python3 -m py_compile -p $P/tsconfig.card.json\n");
  expect(vitestStep(PYTHON, "x").startsWith("python3 -m pytest x -q --tb=short > $P/vt.log 2>&1 || { ")).toBe(true);
});

test("§2.2 types", () => {
  expectTypeOf(heredoc).toEqualTypeOf<(path: string, body: string, tag: string) => string>();
  expectTypeOf(wrapScript).parameters.toEqualTypeOf<[string, string, readonly string[], string]>();
  expectTypeOf(vitestStep).toEqualTypeOf<(profile: LanguageProfile, args: string) => string>();
  expectTypeOf(fullArgs).toEqualTypeOf<(exclude: readonly string[]) => string>();
  expectTypeOf(namesKept).toEqualTypeOf<(file: string, drop: readonly string[]) => string>();
  expectTypeOf(OWN_GIT_BEFORE).toEqualTypeOf<string>();
});

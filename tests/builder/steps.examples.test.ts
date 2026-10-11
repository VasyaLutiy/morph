import { test, expect } from "vitest";
import { fixture } from "../helpers.js";
import { TYPESCRIPT } from "../../src/language/profiles.js";
import {
  heredoc,
  wrapScript,
  tscStep,
  eslintStep,
  fullArgs,
  vitestStep,
  frozenStep,
  untrackedStep,
  OWN_GIT_BEFORE,
  OWN_GIT_AFTER,
  namesKept,
} from "../../src/builder/steps.js";

test("Wrap Script example 1: trailing blank lines dropped", () => {
  expect(heredoc("$P/x.json", "[1]\n\n", "MORPH_X_EOF")).toBe(
    "cat > $P/x.json <<'MORPH_X_EOF'\n[1]\nMORPH_X_EOF\n",
  );
});

test("Wrap Script example 2: the whole wrap script", () => {
  expect(wrapScript("c", "p1", ["src/a.ts", "Makefile"], "echo hi\n")).toBe(
    fixture("builder/wrap.txt"),
  );
});

test("Check Steps example 1: tsc and eslint lines", () => {
  expect(tscStep(TYPESCRIPT)).toBe(
    "echo '== tsc'; node_modules/.bin/tsc --noEmit -p $P/tsconfig.card.json\n",
  );
  expect(eslintStep(TYPESCRIPT, ["src/a.ts", "tests/a.test.ts"])).toBe(
    "echo '== eslint'; E=0; node_modules/.bin/eslint src/a.ts tests/a.test.ts || E=1\n",
  );
});

test("Check Steps example 2: fullArgs", () => {
  expect(fullArgs([])).toBe("--passWithNoTests");
  expect(fullArgs(["tests/x.test.ts", "tests/y.test.ts"])).toBe(
    "--passWithNoTests --exclude tests/x.test.ts --exclude tests/y.test.ts",
  );
});

test("Check Steps example 3: the vitest failure report", () => {
  expect(vitestStep(TYPESCRIPT, "tests/a.test.ts")).toBe(fixture("builder/vitestStep.txt"));
});

test("Tree Steps example 1: frozen and untracked", () => {
  expect(frozenStep(["docs", "decks"])).toBe(fixture("builder/frozen.txt"));
  expect(untrackedStep(["src/a.ts", "src/b.ts"])).toBe(fixture("builder/untracked.txt"));
});

test("Tree Steps example 2: names kept", () => {
  expect(
    namesKept("tests/a.examples.test.ts", ["A example 4: old"]) +
      namesKept("tests/b.examples.test.ts", []),
  ).toBe(fixture("builder/names.txt"));
});

test("Tree Steps example 3: own git", () => {
  expect(OWN_GIT_BEFORE + OWN_GIT_AFTER).toBe(fixture("builder/ownGit.txt"));
});

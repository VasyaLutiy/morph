// P15 probe for build-acceptances by docs/TASK_P15_golang.md §2.2 (src/builder/buildAcceptances.ts) — the go profile
// built by goAcceptance.ts, any other non-typescript profile refused, a card without a target of the profile refused,
// probeFile. Record Build Acceptances examples 4 (changed), 5 and 6, then the §2.2 rows.
import { test, expect } from "vitest";
import { buildAcceptances, probeFile } from "../../src/builder/buildAcceptances.js";
import { codeAcceptance } from "../../src/builder/compose.js";
import { goCodeAcceptance, goJudgeAcceptance } from "../../src/builder/goAcceptance.js";
import { DEFAULT_FROZEN } from "../../src/builder/readChecks.js";
import { GO, PYTHON, TYPESCRIPT } from "../../src/language/profiles.js";
import type { CardContext, Checks } from "../../src/builder/types.js";
import type { Card } from "../../src/cards/types.js";
import { fixture } from "../../tests/helpers.js";

const card = (id: string, targets: string[], dependsOn: string[] = []): Card => ({
  customId: id, intent: "patch", targets, contextSlice: [], instruction: "x", acceptance: null, model: null,
  maxTokens: null, reasoning: null, variants: 1, dependsOn,
});
const checks = (phase: string, frozen: string[], cards: Checks["cards"]): Checks => ({
  version: 1, phase, parts: "decks/" + phase + "/parts", frozen, fullExclude: [], ownGit: false, cards,
});
const code = (id: string, smoke: number | null = null): Checks["cards"][number] => ({ id, smoke, extra: null, files: null });
const ctx = (over: Partial<CardContext>): CardContext => ({
  id: "percent-of", phase: "m1", targets: ["calc/percent_of.go"], siblings: [], frozen: ["go.mod", "internal"],
  fullExclude: [], ownGit: false, profile: GO, guard: "// guard\n", firstdiff: "// firstdiff\n", ...over,
});
const texts = (probes: Record<string, string>) => ({ guard: "// guard\n", firstdiff: "// firstdiff\n", probes });
const JF = { file: "calc/clamp_value_examples_test.go", min: 4, max: 10, lits: ["TestClampValueExample1"], drop: [], new: true };

test("Build Acceptances example 4 (changed): python is refused, the two builders named", () => {
  expect(buildAcceptances({ cards: [card("a", ["a/b.py"])], checks: checks("p1", DEFAULT_FROZEN, [code("a")]), profile: PYTHON,
    texts: texts({ a: "# probe\n" }) })).toStrictEqual({ ok: false, errors: ["no acceptance builder for language 'python' (only typescript, go)"] });
});

test("Build Acceptances example 5: the go cut — goCodeAcceptance and goJudgeAcceptance with their siblings", () => {
  const r = buildAcceptances({
    cards: [card("percent-of", ["calc/percent_of.go"]), card("clamp-value-judge", ["calc/clamp_value_examples_test.go"])],
    checks: checks("m1", ["go.mod", "internal"], [code("percent-of"), { id: "clamp-value-judge", smoke: null, extra: null, files: [JF] }]),
    profile: GO, texts: texts({ "percent-of": "package calc\n" }),
  });
  if (!r.ok) throw new Error("expected ok: " + r.errors.join("; "));
  expect(r.cards[0].acceptance).toBe(fixture("builder/go/code1.txt"));
  expect(r.cards[1].acceptance).toBe(goJudgeAcceptance(ctx({ id: "clamp-value-judge", targets: ["calc/clamp_value_examples_test.go"],
    siblings: ["calc/percent_of.go"] }), [JF]));
});

test("Build Acceptances example 6: a card with no target of the profile; probeFile of both profiles", () => {
  expect(buildAcceptances({ cards: [card("a", ["src/x/a.ts"]), card("b", ["calc/b.go"])], checks: checks("m1", DEFAULT_FROZEN, [code("a"), code("b")]),
    profile: GO, texts: texts({ a: "// probe\n" }) })).toStrictEqual({ ok: false, errors: ["card 'a' has no go target", "code card 'b' has no probe"] });
  expect(probeFile(GO, "percent-of")).toBe("_percent-of_probe_test.go");
  expect(probeFile(TYPESCRIPT, "a")).toBe("a.probe.ts");
  expect(probeFile(PYTHON, "k2")).toBe("k2.probe.ts");
});

test("rows: a go smoke card, the typescript path untouched, the error order, a typescript card under go", () => {
  const smoke = buildAcceptances({ cards: [card("w", ["web/w.go", "web/w_test.go"]), card("v", ["web/v.go"], ["w"])],
    checks: { ...checks("q2", ["go.mod"], [code("w", 3), code("v")]), ownGit: true, fullExclude: ["web/old_test.go"] },
    profile: GO, texts: texts({ w: "package web\n", v: "package web\n// v\n" }) });
  if (!smoke.ok) throw new Error("expected ok: " + smoke.errors.join("; "));
  expect(smoke.cards[0].acceptance).toBe(goCodeAcceptance(ctx({ id: "w", phase: "q2", targets: ["web/w.go", "web/w_test.go"],
    frozen: ["go.mod"], fullExclude: ["web/old_test.go"], ownGit: true }), "package web\n", 3, null));
  expect(smoke.cards[1].acceptance).toBe(goCodeAcceptance(ctx({ id: "v", phase: "q2", targets: ["web/v.go"], frozen: ["go.mod"],
    fullExclude: ["web/old_test.go"], ownGit: true }), "package web\n// v\n", null, null));
  const ts = buildAcceptances({ cards: [card("a", ["src/x/a.ts"])], checks: checks("p1", DEFAULT_FROZEN, [code("a")]), profile: TYPESCRIPT,
    texts: texts({ a: "// probe\n" }) });
  if (!ts.ok) throw new Error("expected ok");
  expect(ts.cards[0].acceptance).toBe(codeAcceptance({ ...ctx({}), id: "a", phase: "p1", targets: ["src/x/a.ts"], frozen: DEFAULT_FROZEN,
    profile: TYPESCRIPT }, "// probe\n", null, null));
  expect(buildAcceptances({ cards: [card("a", ["src/x/a.ts", "README.md"]), card("j", ["tests/x/j.examples.test.ts"])],
    checks: checks("p1", DEFAULT_FROZEN, [{ id: "j", smoke: null, extra: null, files: [{ ...JF, file: "x/j_test.go" }] }, code("z"), code("a")]),
    profile: GO, texts: texts({}) })).toStrictEqual({ ok: false, errors: [
    "card 'j' has no go target",
    "judge 'j': files [\"x/j_test.go\"] are not its targets [\"tests/x/j.examples.test.ts\"]",
    "checks card 'z' is not in the deck",
    "card 'a' has no go target",
    "code card 'a' has no probe"] });
});

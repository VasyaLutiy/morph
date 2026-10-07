#!/usr/bin/env python3
"""The one acceptance builder of MorphV2: every acceptance of every deck is built from the
shared steps here. Hand-written data, never product code.

    python3 decks/tools/build.py p0     -> decks/p0-scaffold.json (one card, run alone)
    python3 decks/tools/build.py p1     -> acceptance of every P1 card injected into morph-map.json
                                           (mrph plan --spec copies it onto the card)
    python3 decks/tools/build.py p2     -> the same for the P2 cards (Component compiler)
    python3 decks/tools/build.py p3     -> the same for the P3 cards (Component acceptance; code
                                           cards write no test file, the probe covers them)
    python3 decks/tools/build.py p4     -> the same for the P4 cards (Component processor, sync route)
    python3 decks/tools/build.py p5     -> the same for the P5 cards (Component runloop)
    python3 decks/tools/build.py p6     -> the same for the P6 cards (Component git; every chain also
                                           checks that the repository's own HEAD and refs are unchanged)
    python3 decks/tools/build.py p7     -> the same for the P7 cards (Component cli; own git as P6; the
                                           main card also builds the binary and runs it once; judges
                                           have their own-test caps)
    python3 decks/tools/build.py p8     -> the same for the P8 cards (Component language; pure, no
                                           git and no spawn in the tests; judges capped at examples + 8)
    python3 decks/tools/build.py p9     -> the same for the P9 cards (Component contour; pure, no node:* in src,
                                           yaml only in src/contour/load.ts; judges capped at examples + 8)
    python3 decks/tools/build.py p9b    -> the P9b patch cards (runloop + compiler); do not re-run after p9c
    python3 decks/tools/build.py p9c    -> the P9c patch cards (runloop + acceptance; judges patch one or two
                                           files each, names kept per file; every failed vitest step also
                                           prints where two long strings first differ)
    python3 decks/tools/build.py p10    -> the P10a cards (planner + cli; judges by files, two patched cli test files
                                           deselected from the full step; locate and full_report on)
    python3 decks/tools/build.py p10b   -> the P10b1 cards (Component builder; judges by files, all new; the deck is cut by V2)
    python3 decks/tools/build.py p10b2  -> the P10b2 cards (Component cli: --checks; judges by files, all new; the last
                                           phase built here: from P10b2 on `morph plan --checks decks/<phase>/checks.json`)

From P10 a phase sets "locate": True and "full_report": True: a failed vitest step prints its whole
failure section with the Expected/Received diff, and a red eslint is reported after the probe / own
test instead of stopping before them (issue #3, B). Frozen after the switch to V2: the V2 planner
builds the acceptances from the language profile (issue #3, A); this file gets no new features.

Paths are relative to the repository root (the parent of decks/); nothing here points
outside the tree.
"""
import json
import os
import sys

HERE = os.path.dirname(os.path.abspath(__file__))
ROOT = os.path.abspath(os.path.join(HERE, "..", ".."))
GUARD = os.path.join(HERE, "guard.mjs")
FIRSTDIFF = os.path.join(HERE, "firstdiff.mjs")
# P9c on: a failed vitest step also prints where the two sides of a long comparison first differ
LOCATE = {"on": False}
# P10 on (Fable review 07.10, issue #3 B): a failed vitest step prints its whole failure section, the
# `- Expected / + Received` diff included (the old grep dropped it, so the expected literal lived only
# in the probe inside the command); and eslint no longer stops the chain before the probe / own test
FULL = {"on": False}
CONVENTIONS = "docs/CONVENTIONS.md"
FROZEN = "contour.yaml morph-map.json docs decks tests/fixtures"

HELPER_EXPORTS = ["TmpRoot", "tmpRoot", "TmpRepo", "tmpRepo", "FakeReply", "FakeResponse", "FakeCall",
                  "FakeFetch", "fakeFetch", "FakeClock", "fakeClock", "flush", "fixturePath", "fixture",
                  "fixtureJson"]

SCAFFOLD = ["package.json", "tsconfig.json", "tsconfig.build.json", "vitest.config.ts",
            "eslint.config.js", "tests/setup.ts", "tests/helpers.ts", "src/index.ts"]


def read(path):
    with open(path, encoding="utf-8") as fh:
        return fh.read()


def heredoc(path, body, tag):
    assert tag not in body
    return f"cat > {path} <<'{tag}'\n{body.rstrip()}\n{tag}\n"


# ----------------------------------------------------------------------------- shared steps

def snapshot(card, phase, targets):
    """Keep the attempt's bytes outside the tree: a rejected attempt is rolled back by Morph."""
    lines = [f"D=/tmp/morph/{card}-{phase}; mkdir -p $D; S=$(date +%s)-$$; L=$D/acc-$S.log"]
    for n, t in enumerate(targets):
        ext = os.path.splitext(t)[1] or ".txt"
        lines.append(f"cp {t} $D/{n}-$S{ext} 2>/dev/null")
    return "\n".join(lines) + "\n"


def wrap(card, phase, targets, body):
    return (snapshot(card, phase, targets)
            + "(\n set -e\n export NO_COLOR=1 CI=1\n" + body
            + ") > $L 2>&1; rc=$?; cat $L; exit $rc")


def probe_dir(card, parts, probe_file=None, exclude=()):
    """probe/<card>/ with the guard, a vitest config and tsconfig.card.json, which type-checks
    the probe together with the project MINUS ``exclude`` (the targets of the other cards of
    the same generation: a sibling's broken file cannot redden this card); removed on exit."""
    conf = (
        'import { defineConfig } from "vitest/config";\n'
        'import { fileURLToPath } from "node:url";\n'
        'export default defineConfig({\n'
        '  root: fileURLToPath(new URL("../..", import.meta.url)),\n'
        f'  test: {{ environment: "node", include: ["probe/{card}/**/*.probe.ts"],\n'
        '    setupFiles: ["tests/setup.ts"], chaiConfig: { truncateThreshold: 200 } },\n'
        '});\n')
    tsconf = {"extends": "../../tsconfig.json", "include": ["../../src", "../../tests", "./*.probe.ts"]}
    if exclude:
        tsconf["exclude"] = ["../../" + t for t in exclude]
    tsconf = json.dumps(tsconf, indent=2) + "\n"
    s = (f"P=$PWD/probe/{card}; rm -rf $P; mkdir -p $P; trap 'rm -rf $P' EXIT\n"
         + heredoc("$P/guard.mjs", read(GUARD), "MORPH_GUARD_EOF")
         + heredoc("$P/probe.config.mts", conf, "MORPH_CONF_EOF")
         + heredoc("$P/tsconfig.card.json", tsconf, "MORPH_TSCONF_EOF"))
    if LOCATE["on"]:
        s += heredoc("$P/firstdiff.mjs", read(FIRSTDIFF), "MORPH_FIRSTDIFF_EOF")
    if probe_file:
        s += heredoc(f"$P/{card}.probe.ts", read(os.path.join(parts, probe_file)), "MORPH_PROBE_EOF")
    return s


def vt(args):
    locate = "; node $P/firstdiff.mjs $P/vt.log" if LOCATE["on"] else ""
    if FULL["on"]:
        show = ("{ if grep -q '^ FAIL ' $P/vt.log; then awk '/^ FAIL /{p=1} p' $P/vt.log | "
                "grep -vE '^ +(Start at|Duration) ' | head -200; else tail -60 $P/vt.log; fi")
    else:
        show = "{ grep -E '^ FAIL |Error|AssertionError|^ +Tests |^ +Test Files |expected|received' $P/vt.log | head -80"
    return (f"node_modules/.bin/vitest run {args} --reporter=dot > $P/vt.log 2>&1 || "
            + show + locate + "; exit 1; }\n")


def eslint(files):
    """FULL: eslint's verdict is held until after the probe / own test, so a lint-only red still shows
    whether the behaviour is right (old-C v1 of P9: probe 13/13 green, killed by an unused import)."""
    if FULL["on"]:
        return "echo '== eslint'; E=0; node_modules/.bin/eslint " + files + " || E=1\n"
    return "echo '== eslint'; node_modules/.bin/eslint " + files + "\n"


def eslint_verdict():
    return ('[ "$E" = 0 ] || { echo "== eslint failed (see above); every step between it and here passed"; exit 1; }\n'
            if FULL["on"] else "")


def tsc_probe():
    return "echo '== tsc'; node_modules/.bin/tsc --noEmit -p $P/tsconfig.card.json\n"


def eslint_src_tests():
    return "echo '== eslint'; node_modules/.bin/eslint src tests\n"


def frozen(paths=FROZEN):
    return (f'git diff --quiet HEAD -- {paths} || {{ echo "changed outside the targets: '
            f'$(git diff --name-only HEAD -- {paths} | tr "\\n" " ")"; exit 1; }}\n')


def untracked(targets, extra=()):
    keep = " ".join(f"-e {t}" for t in list(targets) + list(extra))
    return ('X=$(git ls-files --others --exclude-standard | grep -vxF ' + keep + ' || true); '
            '[ -z "$X" ] || { echo "files left in the tree: $X"; exit 1; }\n')


# ----------------------------------------------------------------------------- P0

def scaffold_acceptance(parts):
    body = (
        "echo '== npm install'; npm install --no-audit --no-fund > /dev/null 2>&1 || "
        "{ echo 'npm install failed:'; npm install --no-audit --no-fund 2>&1 | tail -20; exit 1; }\n"
        + probe_dir("scaffold", parts, "scaffold.probe.ts")
        + tsc_probe()
        + "echo '== strict'; node_modules/.bin/tsc --showConfig | node -e 'let s=\"\";process.stdin.on(\"data\",d=>s+=d)"
          ".on(\"end\",()=>{const c=JSON.parse(s).compilerOptions||{};const bad=[];"
          "if(c.strict!==true)bad.push(\"strict is not true\");"
          "if(String(c.module).toLowerCase()!==\"nodenext\")bad.push(\"module is not NodeNext\");"
          "if(bad.length){console.log(\"tsconfig: \"+bad.join(\"; \"));process.exit(1)}})'\n"
        + "echo '== build'; rm -rf dist; node_modules/.bin/tsc -p tsconfig.build.json; "
          "[ -f dist/index.js ] || { echo \"build: dist/index.js missing, dist holds: $(ls -A dist 2>/dev/null | tr '\\n' ' ')\"; exit 1; }; rm -rf dist\n"
        + eslint_src_tests()
        + "echo '== eslint rejects any'; printf 'export const x: any = 1;\\n' > $P/any.ts; "
          "if node_modules/.bin/eslint $P/any.ts > $P/any.log 2>&1; then echo 'eslint accepted an explicit any'; exit 1; fi; "
          "grep -q 'no-explicit-any' $P/any.log || { echo 'eslint rejected probe/scaffold/any.ts for another reason:'; head -5 $P/any.log; exit 1; }\n"
        + "echo '== guard'; node $P/guard.mjs src; node $P/guard.mjs helpers tests/helpers.ts " + ",".join(HELPER_EXPORTS) + "\n"
        + "echo '== probe'; " + vt("--config $P/probe.config.mts")
        + "echo '== full'; " + vt("--passWithNoTests")
        + "echo '== frozen'; " + frozen()
        + untracked(SCAFFOLD, ["package-lock.json"]))
    return wrap("scaffold", "p0", SCAFFOLD, body)


SCAFFOLD_INSTRUCTION = (
    "Read docs/TASK_P0_scaffold.md FIRST: section 2.2 gives every file's exact content shape and "
    "every version pin, section 2.3 the signatures of tests/setup.ts and tests/helpers.ts, which "
    "are the contract. docs/CONVENTIONS.md is the style of the whole tree. The two fixtures under "
    "tests/fixtures/p0/ are in your context.\n\n"
    "You write the scaffold of a Node 20 TypeScript project at the repository root, the eight "
    "files named in your targets and nothing else: package.json, tsconfig.json, tsconfig.build.json, "
    "vitest.config.ts, eslint.config.js, tests/setup.ts, tests/helpers.ts, src/index.ts. There is no "
    "other code yet.\n\n"
    "TypeScript strict, ESM, module and moduleResolution NodeNext (so every relative import carries "
    "the .js extension and types are imported with `import type`), no `any` (use `unknown` and "
    "narrow). tests/helpers.ts imports only node:* modules: never src/, never vitest. The versions in "
    "package.json are exact strings, no ^ or ~, and exactly the packages listed. fakeClock uses no "
    "real timer: nothing in helpers names setTimeout or setInterval; flush awaits setImmediate from "
    "node:timers/promises. tmpRepo shells out to git with execFileSync from node:child_process.\n\n"
    "Write no test file and no package-lock.json: the acceptance runs npm install (which writes the "
    "lock file), tsc, eslint, a guard on the syntax tree and a probe built from section 2.3.")


def build_p0():
    parts = os.path.join(ROOT, "decks", "p0", "parts")
    card = {
        "custom_id": "scaffold", "intent": "generate", "targets": SCAFFOLD,
        "context_slice": ["docs/TASK_P0_scaffold.md", CONVENTIONS,
                          "tests/fixtures/p0/hello.txt", "tests/fixtures/p0/hello.json"],
        "depends_on": [], "variants": 2, "max_tokens": 32000, "reasoning_max_tokens": 2500,
        "acceptance": scaffold_acceptance(parts), "instruction": SCAFFOLD_INSTRUCTION}
    out = os.path.join(ROOT, "decks", "p0-scaffold.json")
    with open(out, "w", encoding="utf-8") as fh:
        json.dump([card], fh, indent=2, ensure_ascii=False)
        fh.write("\n")
    print(f"wrote {os.path.relpath(out, ROOT)}: 1 card, acceptance {len(card['acceptance'])} chars")


# ----------------------------------------------------------------------------- P1

MAP = "morph-map.json"
P1_TEST_DIR = "tests/cards"
# literals of the record's examples a judge's test must mention (docs/TASK_P1_cards.md §3)
P1_JUDGE_LITERALS = {
    "card-model-judge": ["bad id", "^[A-Za-z0-9._-]+$", "todo", "./src/a.ts",
                         "duplicate customId b", "a -> b -> a", "zzz"],
    "layering-judge": ['[["a"],["b","c"],["d"]]', '[["a","b"]]'],
    "hazards-judge": ["write-write", "read-write", "src/x.ts", "addDependsOn"],
    "weigh-judge": ["600001", "500000", "oversized-slice"],
}
# examples per judge = examples of its Function(s) in contour.yaml (Validate Card 4 + Load
# Deck 3; Layer Generations 2; Find Hazards 2; Weigh Slices 1): min = examples, max = min + 12
P1_JUDGE_EXAMPLES = {"card-model-judge": 7, "layering-judge": 2, "hazards-judge": 2, "weigh-judge": 1}
P1_SMOKE_MAX = 5

P2_TEST_DIR = "tests/compiler"
# docs/TASK_P2_compiler.md §3: the example literals of Component compiler
P2_JUDGE_LITERALS = {
    "compile-card-judge": ["a.v1", "a.v2", "docs/A.md", "docs/B.md", "Original file src/x.ts:", "docs/missing.md"],
    "output-directive-judge": ["FILE: ", "src/a.ts", "tests/a.test.ts"],
    "capture-inputs-judge": ["87428fc522803d31", "absent", "src/x.ts", "tests/x.test.ts"],
    "parse-answer-judge": ["export const a = 1;", "missing section for tests/a.test.ts", "truncated"],
}
# Compile Card 3, Output Directive 1, Capture Inputs 2, Parse Answer 3 (contour.yaml, Component compiler)
P2_JUDGE_EXAMPLES = {"compile-card-judge": 3, "output-directive-judge": 1, "capture-inputs-judge": 2,
                     "parse-answer-judge": 3}

P3_TEST_DIR = "tests/acceptance"
# docs/TASK_P3_acceptance.md §3: the example literals of Component acceptance
P3_JUDGE_LITERALS = {
    "snapshot-targets-judge": ["src/b.ts", "src/deep/a.ts", "ff00fe0a"],
    "run-acceptance-judge": ["echo out; echo err >&2; exit 3", "1 1 bar unset", "sleep.pid",
                             "acceptance timed out after 200 ms", "longLogClipped.txt"],
    "verify-card-judge": ["c.v3", "answer corrupt: missing section for src/a.ts", "answer truncated",
                          "@@ -1,1 +1,1 @@"],
    "build-attempt-diff-judge": ["@@ -2,7 +2,7 @@", "--- /dev/null", "@@ -15,6 +15,6 @@",
                                 "[diff clipped: 10339 chars]", "bigAfter.txt"],
}
# Snapshot Targets 3, Run Acceptance 4, Verify Card 3, Build Attempt Diff 4 (contour.yaml, Component acceptance)
P3_JUDGE_EXAMPLES = {"snapshot-targets-judge": 3, "run-acceptance-judge": 4, "verify-card-judge": 3,
                     "build-attempt-diff-judge": 4}

P4_TEST_DIR = "tests/processor"
# docs/TASK_P4_processor.md §3: the example literals of Component processor
P4_JUDGE_LITERALS = {
    "read-registry-judge": ["glmConfig.json", "must be a positive integer", "MORPH_PROCESSOR_e_FOO is not a known key",
                            "MORPH_PROCESSOR_x_TYPE is required", "/tmp/answers"],
    "assemble-request-judge": ["Bearer sk-or-test", "http://127.0.0.1:9/v1/", "allow_fallbacks", "tool_choice"],
    "read-response-judge": ["okResponse.json", "lengthResponse.json", "errorResponse.json",
                            "gen-0000000001-TESTtestTESTtestTEST", "unreadable response: <html>bad gateway</html>",
                            "stub-a.v1", "stub has no answer: "],
    "send-generation-judge": ["fakeFetch", "failAll", "socket hang up (after 3 attempts)", "upstream down",
                              "Insufficient credits"],
}
# Read Registry 4, Assemble Request 2, Read Response 4 + Stub Answer 3, Send Generation 5
P4_JUDGE_EXAMPLES = {"read-registry-judge": 4, "assemble-request-judge": 2, "read-response-judge": 7,
                     "send-generation-judge": 5}

P5_TEST_DIR = "tests/runloop"
# docs/TASK_P5_runloop.md §3: the example literals of Component runloop
P5_JUDGE_LITERALS = {
    "resolve-judge": ["dependency a failed", "dependency b skipped", "budget-exceeded"],
    "process-generation-judge": ["written", "acceptance failed", "stale inputs", "stub"],
    "build-retry-judge": ["c.r1", "c.r2", "Acceptance output:", "buildRetry: attempt must be 1 or 2"],
    "run-deck-judge": ["budget-exceeded", "deadline", "written"],
}
# Resolve Runnable 4, Process Generation 3, Build Retry 3, Run Deck 3
P5_JUDGE_EXAMPLES = {"resolve-judge": 4, "process-generation-judge": 3, "build-retry-judge": 3,
                     "run-deck-judge": 3}

P6_TEST_DIR = "tests/git"
# docs/TASK_P6_git.md §3: the example literals of Component git
P6_JUDGE_LITERALS = {
    "run-git-judge": ["C 0 bar unset", "error: pathspec 'nope' did not match", "git checkout failed (exit 1): ",
                      "ada@example.invalid"],
    "open-branch-judge": ["morph/r1", ".morph/deck.json", "dirty tree outside .morph/: README.md, src/a.ts",
                          "branch morph/r4 already exists", "invalid runId: a b"],
    "commit-card-judge": ["other.txt", "morph a: src/a.ts, src/b.ts", "Morph-Variant: c.v2",
                          "Morph-Model: stub", "makeCommitHook"],
    "archive-run-judge": ["morph run r1: deck and report", "Morph-Budget-Exceeded: 0",
                          "archive .morph/runs/r1 already exists", "written but not committed: git add failed (exit 1): "],
}
# Run Git 3, Open Run Branch 4, Commit Paths 2 + Commit Card 3, Archive Run 3
P6_JUDGE_EXAMPLES = {"run-git-judge": 3, "open-branch-judge": 4, "commit-card-judge": 5, "archive-run-judge": 3}

P7_TEST_DIR = "tests/cli"
# docs/TASK_P7_cli.md §3: the example literals of Component cli
P7_JUDGE_LITERALS = {
    "document-judge": ['{"a":1,"b":[true,null]}', "RuntimeError", "deck file not found: nope.json",
                       "invalid deck: dependsOn: dependsOn cycle a -> b -> a"],
    "parse-command-judge": ["unknown command: frobnicate", "command deck status is not available yet",
                            "flag --processor does not apply to deck check", "no command (commands: deck check, run)"],
    "deck-check-judge": ["write-write", "oversized-slice", "docs/b.md"],
    "run-command-judge": ["morph run r1: deck and report", "processor nope is not configured",
                          "dirty tree outside .morph/: notes.txt", "deck has 1 hazard error(s): write-write a,b out/x.ts",
                          "20261006-180909"],
    "main-judge": ["morph: unknown command: frobnicate", "tsconfig.build.json", '{"type":"module"}',
                   "morph run e2e: deck and report", "git status failed (exit 128): "],
}
# Emit Document 3 + Classify Error 3 + Read Deck File 3, Parse Command 8, Deck Check 3, Run Command 6, Main 5
P7_JUDGE_EXAMPLES = {"document-judge": 9, "parse-command-judge": 8, "deck-check-judge": 3, "run-command-judge": 6,
                     "main-judge": 5}
# own tests on top of the examples (TASK_P7 §2.3): the heavy run and e2e files stay small (P5 truncation lesson)
P7_JUDGE_OWN = {"document-judge": 8, "parse-command-judge": 8, "deck-check-judge": 6, "run-command-judge": 4,
                "main-judge": 3}
# the main card builds the real binary once and runs it on a bad command (TASK_P7 §3 step 6)
P7_BIN_STEP = ("echo '== bin'; npm run build > $P/build.log 2>&1 || { echo 'bin: npm run build failed:'; tail -20 $P/build.log; exit 1; }; "
               "BC=0; B=$(node dist/cli.js frobnicate 2>/dev/null) || BC=$?; "
               "[ \"$BC\" = 4 ] && [ \"$B\" = '{\"error\":{\"code\":4,\"kind\":\"UsageError\",\"message\":\"unknown command: frobnicate\"}}' ] || "
               "{ echo \"bin: node dist/cli.js frobnicate gave exit $BC and stdout: $B\" | head -c 600; echo; exit 1; }\n")

P8_TEST_DIR = "tests/language"
# docs/TASK_P8_language.md §3: the example literals of Component language
P8_JUDGE_LITERALS = {
    "profiles-judge": ["typescript.json", "python.json", "unknown language 'go' (known: typescript, python)",
                       "$&-$&-{c}", "{b}x"],
    "paths-judge": ["src/__tests__/x.ts", "pkg/a_test.py", "./src/c.ts", "x/y.PYI", "Makefile"],
    "naming-judge": ["parse-command", "run_loop/process_generation.py", "buildHttpRequestV2",
                     "no letters or digits in name '--'"],
    "template-judge": ["scriptTs.txt", "scriptPy.txt", "python3 -m py_compile pkg/a.py tests/test_a.py",
                       "node_modules/.bin/eslint src/a.ts tests/a.test.ts", "this instruction"],
}
# Resolve Profile 4 + Fill Template 3, Classify Path 4 + Detect Profile 2, Name Targets 4,
# Acceptance Lines 4 + Acceptance Script 2 + Judge Instruction 2
P8_JUDGE_EXAMPLES = {"profiles-judge": 7, "paths-judge": 6, "naming-judge": 4, "template-judge": 8}
P8_JUDGE_OWN = {"profiles-judge": 8, "paths-judge": 8, "naming-judge": 8, "template-judge": 8}

P9_TEST_DIR = "tests/contour"
# docs/TASK_P9_contour.md §3: the example literals of Component contour
P9_JUDGE_LITERALS = {
    "validate-record-judge": ["mini.typed.json", "badRecord.problems.json", "(root): a record must be an object",
                              "System: required", "System.groups[0].functions[0].examples: required"],
    "validate-map-judge": ["mini.map.typed.json", "badMap.problems.json", "(root): a map must be an object",
                           "cards.g.context_slice[0]: must be a non-empty string"],
    "select-components-judge": ["the record has 2 Components (tally, store): pass --component",
                                "no Component 'nope' in the record (have: tally, store)", "badCalls.json",
                                "Function 'C' calls itself", "node:fs"],
    "load-spec-judge": ["mini.yaml", "is not a valid record (19 problems):", "is not a valid map (15 problems):",
                        "\u2026 and 2 more", "is not a mapping at the top level", "../../contour.yaml",
                        "../../morph-map.json", "validate-record"],
}
# Validate Record 6, Validate Map 4, Select Components 3 + Function Links 3, Parse Document 3 + Load Spec 4
P9_JUDGE_EXAMPLES = {"validate-record-judge": 6, "validate-map-judge": 4, "select-components-judge": 6,
                     "load-spec-judge": 7}
P9_JUDGE_OWN = {"validate-record-judge": 8, "validate-map-judge": 8, "select-components-judge": 8, "load-spec-judge": 8}

P9B_TEST_DIR = "tests/runloop"
# docs/TASK_P9b_runloop.md §3: the example literals of the new examples (runloop, compiler)
P9B_JUDGE_LITERALS = {
    "process-generation-judge": ["retryContexts", "answer truncated", "contextSlice 'docs/missing.md' does not exist",
                                 "glm-x", "@@ -1,1 +1,1 @@"],
    "build-retry-judge": ["The diff above is your own previous edit: correct it where it went wrong instead of "
                          "rewriting the files from scratch.", "Write c."],
    "run-deck-judge": ["https://openrouter.ai/api/v1/chat/completions", "Novita", "gen-1", "first-red", "--- /dev/null",
                       "z-ai/glm-5.3"],
    "output-directive-judge": ["This card writes 2 files.", "This card writes 3 files.",
                               "Return the complete content of src/a.ts as ONE fenced block, and nothing else:",
                               "outputDirective"],
    "compile-card-judge": ["outputDirective", "Compile Card example 1", "several targets get the section directive"],
}
# min = the NEW examples each judge writes (Process Generation 4-7, Build Retry 4, Run Deck 4-5, Output
# Directive 1-4; the compile patch keeps Compile Card 1-3); max = min + own below (= all the Function's
# examples + 8; the compile patch keeps exactly its 10 tests)
P9B_JUDGE_EXAMPLES = {"process-generation-judge": 4, "build-retry-judge": 1, "run-deck-judge": 2,
                      "output-directive-judge": 4, "compile-card-judge": 3}
P9B_JUDGE_OWN = {"process-generation-judge": 11, "build-retry-judge": 11, "run-deck-judge": 11,
                 "output-directive-judge": 8, "compile-card-judge": 7}
# the two P2 files that pin the old directive text: red from output-directive's acceptance (gen 1) until
# their judges rewrite them (gen 2); deselected from every full step, each judge runs its own file
P9B_KNOWN_RED = ["tests/compiler/compile.examples.test.ts", "tests/compiler/directive.examples.test.ts"]

P9C_TEST_DIR = "tests/runloop"
# docs/TASK_P9c_retry.md §3: every judge patches its file(s); per file the examples it holds (min), the cap
# (max = min + 8, or + 12 for the P3 file), the literals of the new texts and the HEAD test names it may drop
P9C_RD = "A previous attempt failed its acceptance check (`if [ -f seen ]; then grep -q MARK out/a.ts; else touch seen; echo first-red; exit 1; fi`):"
P9C_JUDGE_FILES = {
    "build-attempt-diff-judge": [
        {"file": "tests/acceptance/diff.examples.test.ts", "min": 5, "max": 17,
         "lits": ["... [4420 characters elided] ...", "5952", "11900", "src/b.ts", "bigAfter.txt", "Build Attempt Diff example 5"],
         "drop": ["Build Attempt Diff example 4: a new 400-line file is clipped to exactly DIFF_CAP"]}],
    "build-retry-judge": [
        {"file": "tests/runloop/retry.examples.test.ts", "min": 3, "max": 11,
         "lits": ["A previous attempt failed its acceptance check (`grep -q MARK src/c.ts`):",
                  "A previous attempt was discarded before acceptance could run:", "c.r2",
                  "buildRetry: attempt must be 1 or 2"],
         "drop": []},
        {"file": "tests/runloop/retry.p9b.examples.test.ts", "min": 3, "max": 11,
         "lits": ["The diff above is YOUR OWN previous edit, not a proposed change: correct it where it went wrong rather "
                  "than rewriting the file from scratch.", "Produce the complete file again, from the context given above.",
                  "Please fix the issues and produce the complete corrected file.", "</previous_attempt_diff>",
                  "Build Retry example 5", "Build Retry example 6"],
         "drop": ["Build Retry: previousDiff null has no diff block and no closing sentence",
                  "Build Retry: an empty string diff is not null and gets the block"]}],
    "process-generation-judge": [
        {"file": "tests/runloop/generation.p9b.examples.test.ts", "min": 5, "max": 13,
         "lits": ["Process Generation example 8"],
         "drop": ["Process Generation own: an attempt that changed nothing gets the block-less context (empty diff is null)"]}],
    "run-deck-judge": [
        {"file": "tests/runloop/deck.p9b.examples.test.ts", "min": 2, "max": 13,
         "lits": [P9C_RD, "<previous_attempt_diff>", "A previous attempt was discarded before acceptance could run:"],
         "drop": []}],
}
P9C_JUDGE_EXAMPLES = {k: sum(f["min"] for f in v) for k, v in P9C_JUDGE_FILES.items()}
# the five files that pin the old behaviour: red from their code card (gen 1) until their judge patches them
# (gen 2); deselected from every full step, each judge runs its own file(s)
P9C_KNOWN_RED = [f["file"] for v in P9C_JUDGE_FILES.values() for f in v]

P10_PLANNER = "tests/planner/"
# docs/TASK_P10a_planner.md §3: every judge by its files (the four planner judges write new files, plan-command-judge
# writes one and patches main.examples, parse-command-judge patches parse.examples); per file min = its examples
# (+ the own tests kept at HEAD for a patched file), max = min + 8 (parse: + 4), the literals, the HEAD names it may drop
P10_JUDGE_FILES = {
    "render-judge": [
        {"file": P10_PLANNER + "render.examples.test.ts", "new": True, "min": 11, "max": 19,
         "lits": ["sumEntries.section.txt", "checkLedger.section.txt", "Exact Sums", "(definition not found in the record)",
                  "29500"], "drop": []}],
    "cut-component-judge": [
        {"file": P10_PLANNER + "cut.examples.test.ts", "new": True, "min": 7, "max": 15,
         "lits": ["ledger.cut.json", "store.cut.json", "badCalls.json", "duplicate customId 'parse-entry'",
                  "Interface 'x' exposes unknown Function 'Nope'"], "drop": []}],
    "cut-judges-judge": [
        {"file": P10_PLANNER + "judges.examples.test.ts", "new": True, "min": 4, "max": 12,
         "lits": ["ledger.judges.json", "extras.judges.json", "Preconditions a test's setup depends on:",
                  "Write the CLI tests."], "drop": []}],
    "plan-spec-judge": [
        {"file": P10_PLANNER + "plan.examples.test.ts", "new": True, "min": 8, "max": 16,
         "lits": ["ledger.golden.json", "ledger.plan.json", "layered.json", "dependency cycle among a, b",
                  "../../contour.yaml", "validate-record"], "drop": []}],
    "plan-command-judge": [
        {"file": "tests/cli/planCommand.examples.test.ts", "new": True, "min": 5, "max": 13,
         "lits": ["ledger.plan.json", "spec file not found: nope.yaml", "morph plan: exit 0\\n", "decks/p.json"], "drop": []},
        {"file": "tests/cli/main.examples.test.ts", "min": 5, "max": 5, "lits": ["symlinkSync"], "drop": []}],
    "parse-command-judge": [
        {"file": "tests/cli/parse.examples.test.ts", "min": 19, "max": 23,
         "lits": ["missing --spec", "no command (commands: deck check, plan, run)", "command scout is not available yet",
                  "flag --judge does not apply to run", "Parse Command example 11"],
         "drop": ["Parse Command example 4: plan and deck status answer NotYetError"]}],
}
P10_JUDGE_EXAMPLES = {k: sum(f["min"] for f in v) for k, v in P10_JUDGE_FILES.items()}
# the two files that pin the old cli: parse.examples red from parse-command (gen 4) and main.examples (the built
# binary imports yaml) red from plan-command (gen 3) until their judges patch them (gen 5); deselected from every
# full step, each judge runs its own files
P10_KNOWN_RED = ["tests/cli/parse.examples.test.ts", "tests/cli/main.examples.test.ts"]

P10B = "tests/builder/"
# docs/TASK_P10b_builder.md §3: every judge writes one new file; min = its examples, max = min + 8, the literals
P10B_JUDGE_FILES = {
    "steps-judge": [
        {"file": P10B + "steps.examples.test.ts", "new": True, "min": 8, "max": 16,
         "lits": ["wrap.txt", "vitestStep.txt", "frozen.txt", "untracked.txt", "names.txt", "ownGit.txt", "MORPH_X_EOF",
                  "--exclude tests/y.test.ts"], "drop": []}],
    "read-checks-judge": [
        {"file": P10B + "readChecks.examples.test.ts", "new": True, "min": 4, "max": 12,
         "lits": ["p10.checks.json", "p10.checks.typed.json", "badChecks.json", "badChecks.problems.json",
                  "(root): checks must be an object", "phase: required"], "drop": []}],
    "probe-dir-judge": [
        {"file": P10B + "probeDir.examples.test.ts", "new": True, "min": 3, "max": 11,
         "lits": ["probeDir.txt", "../../src/b.ts", "./*.probe.ts"], "drop": []}],
    "compose-judge": [
        {"file": P10B + "compose.examples.test.ts", "new": True, "min": 5, "max": 13,
         "lits": ["code1.txt", "code2.txt", "judge1.txt", "judge2.txt", "B example 2: old", "\u00e9"], "drop": []}],
    "build-acceptances-judge": [
        {"file": P10B + "buildAcceptances.examples.test.ts", "new": True, "min": 4, "max": 12,
         "lits": ["v2deck.json", "guard.p10.txt", "firstdiff.p10.txt", "p10.checks.typed.json", "only typescript",
                  "is not in the deck"], "drop": []}],
}
P10B_JUDGE_EXAMPLES = {k: sum(f["min"] for f in v) for k, v in P10B_JUDGE_FILES.items()}

P10B2 = "tests/cli/"
# docs/TASK_P10b2_cli.md §3: every judge writes one new file with the Function's NEW examples only (Parse Command 12-13,
# Read Plan Checks 1-3, Plan Command 6-8); min = those examples, max = min + 8, the literals
P10B2_JUDGE_FILES = {
    "parse-command-judge": [
        {"file": P10B2 + "parseChecks.examples.test.ts", "new": True, "min": 2, "max": 10,
         "lits": ["decks/p1/checks.json", "flag --checks does not apply to run", "flag --checks needs a value",
                  "flag --checks given twice", "Parse Command example 13"], "drop": []}],
    "read-plan-checks-judge": [
        {"file": P10B2 + "readPlanChecks.examples.test.ts", "new": True, "min": 3, "max": 11,
         "lits": ["p1.checks.json", "p1.planChecks.json", "checks file not found: nope.json",
                  "guard file not found: decks/tools/guard.mjs", "locator file not found: decks/tools/firstdiff.mjs",
                  "cannot parse c.json: ", "is not a valid checks document (2 problems)"], "drop": []}],
    "plan-command-judge": [
        {"file": P10B2 + "planChecks.examples.test.ts", "new": True, "min": 3, "max": 11,
         "lits": ["l1.checks.json", "exit 0", "acceptances not built (1 error)", "checks card 'zz' is not in the deck",
                  "p10.map.json", "v2deck.json", "guard.p10.txt", "decks/p10/checks.json"], "drop": []}],
}
P10B2_JUDGE_EXAMPLES = {k: sum(f["min"] for f in v) for k, v in P10B2_JUDGE_FILES.items()}

# one phase = the cards of one Component in morph-map.json (judges are <code>-judge); the
# generation layering and the sibling exclusion are computed within the phase only.
# smoke: whether a code card writes its own smoke test (P1-P2 yes; from P3 a code card covered
# by a probe writes no test file)
PHASES = {
    "p1": {"parts": "p1", "test_dir": P1_TEST_DIR, "examples": P1_JUDGE_EXAMPLES, "literals": P1_JUDGE_LITERALS,
           "smoke": True},
    "p2": {"parts": "p2", "test_dir": P2_TEST_DIR, "examples": P2_JUDGE_EXAMPLES, "literals": P2_JUDGE_LITERALS,
           "smoke": True},
    "p3": {"parts": "p3", "test_dir": P3_TEST_DIR, "examples": P3_JUDGE_EXAMPLES, "literals": P3_JUDGE_LITERALS,
           "smoke": False},
    "p4": {"parts": "p4", "test_dir": P4_TEST_DIR, "examples": P4_JUDGE_EXAMPLES, "literals": P4_JUDGE_LITERALS,
           "smoke": False},
    "p5": {"parts": "p5", "test_dir": P5_TEST_DIR, "examples": P5_JUDGE_EXAMPLES, "literals": P5_JUDGE_LITERALS,
           "smoke": False},
    "p6": {"parts": "p6", "test_dir": P6_TEST_DIR, "examples": P6_JUDGE_EXAMPLES, "literals": P6_JUDGE_LITERALS,
           "smoke": False, "own_git": True},
    "p7": {"parts": "p7", "test_dir": P7_TEST_DIR, "examples": P7_JUDGE_EXAMPLES, "literals": P7_JUDGE_LITERALS,
           "smoke": False, "own_git": True, "own": P7_JUDGE_OWN, "extra": {"main": P7_BIN_STEP}},
    "p8": {"parts": "p8", "test_dir": P8_TEST_DIR, "examples": P8_JUDGE_EXAMPLES, "literals": P8_JUDGE_LITERALS,
           "smoke": False, "own": P8_JUDGE_OWN},
    "p9": {"parts": "p9", "test_dir": P9_TEST_DIR, "examples": P9_JUDGE_EXAMPLES, "literals": P9_JUDGE_LITERALS,
           "smoke": False, "own": P9_JUDGE_OWN},
    # P9b patches two Components: explicit members (compile-card-judge has no code card in the deck), the
    # output-directive card keeps its P2 smoke test, the known-red files are deselected, and the patched judge
    # keeps every test name it had at HEAD
    "p9b": {"parts": "p9b", "test_dir": P9B_TEST_DIR, "examples": P9B_JUDGE_EXAMPLES, "literals": P9B_JUDGE_LITERALS,
            "smoke": False, "own": P9B_JUDGE_OWN,
            "members": ["process-generation", "build-retry", "output-directive", "run-deck", "process-generation-judge",
                        "build-retry-judge", "output-directive-judge", "compile-card-judge", "run-deck-judge"],
            "smoke_dirs": {"output-directive": "tests/compiler"}, "full_exclude": P9B_KNOWN_RED,
            "keep_names": ["compile-card-judge"]},
    # P9c patches two Components: explicit members (run-deck-judge has no code card in the deck: it follows
    # build-retry), the judges patch per-file specs, the known-red files are deselected, firstdiff is on
    "p9c": {"parts": "p9c", "test_dir": P9C_TEST_DIR, "examples": P9C_JUDGE_EXAMPLES, "literals": {},
            "smoke": False, "judge_files": P9C_JUDGE_FILES, "locate": True,
            "members": ["build-attempt-diff", "build-retry", "process-generation", "build-attempt-diff-judge",
                        "build-retry-judge", "process-generation-judge", "run-deck-judge"],
            "full_exclude": P9C_KNOWN_RED},
    # P10a (first phase run by the V2 binary): planner + cli; every judge by its files; locate and the full failure
    # report on (issue #3 B)
    "p10": {"parts": "p10", "test_dir": P10_PLANNER, "examples": P10_JUDGE_EXAMPLES, "literals": {},
            "smoke": False, "judge_files": P10_JUDGE_FILES, "locate": True, "full_report": True,
            "members": ["render", "cut-component", "cut-judges", "plan-spec", "plan-command", "parse-command",
                        "render-judge", "cut-component-judge", "cut-judges-judge", "plan-spec-judge", "plan-command-judge",
                        "parse-command-judge"],
            "full_exclude": P10_KNOWN_RED},
    # P10b1 (the first deck cut by V2: `morph plan` copies these acceptances from the map): Component builder,
    # new files only, no known-red file; locate and the full failure report on
    "p10b": {"parts": "p10b", "test_dir": P10B, "examples": P10B_JUDGE_EXAMPLES, "literals": {},
             "smoke": False, "judge_files": P10B_JUDGE_FILES, "locate": True, "full_report": True,
             "members": ["read-checks", "steps", "probe-dir", "compose", "build-acceptances", "steps-judge",
                         "read-checks-judge", "probe-dir-judge", "compose-judge", "build-acceptances-judge"]},
    # P10b2 (the last phase built here): Component cli, three code cards and three judges, new test files only, no
    # known-red file (the new PlanArgs key is optional: tests/cli/*.examples.test.ts stay green); locate and full on
    "p10b2": {"parts": "p10b2", "test_dir": P10B2, "examples": P10B2_JUDGE_EXAMPLES, "literals": {},
              "smoke": False, "judge_files": P10B2_JUDGE_FILES, "locate": True, "full_report": True,
              "members": ["parse-command", "read-plan-checks", "plan-command", "parse-command-judge",
                          "read-plan-checks-judge", "plan-command-judge"]},
}


def own_git_before():
    """P6: the tests spawn git; they must touch only tmp repos, never this repository's own .git."""
    return ("G0=$( (git symbolic-ref -q HEAD || true; git rev-parse HEAD; "
            "git for-each-ref --format='%(refname) %(objectname)') 2>&1)\n")


def own_git_after():
    return ("echo '== own git'; G1=$( (git symbolic-ref -q HEAD || true; git rev-parse HEAD; "
            "git for-each-ref --format='%(refname) %(objectname)') 2>&1); "
            "[ \"$G0\" = \"$G1\" ] || { echo \"tests changed this repository's HEAD or refs:\"; "
            "echo \"before: $G0\" | head -5; echo \"after: $G1\" | head -5; exit 1; }\n")


def layer(cards):
    """custom_id -> generation by the longest depends_on path (the planner's rule); a judge
    depends on its code card plus whatever the map adds."""
    deps = {}
    for cid, c in cards.items():
        d = list(c.get("depends_on") or [])
        if cid.endswith("-judge") and cid[:-6] in cards and cid[:-6] not in d:
            d.insert(0, cid[:-6])
        deps[cid] = [x for x in d if x in cards]
    gen = {}

    def of(cid, stack=()):
        if cid in gen:
            return gen[cid]
        assert cid not in stack, f"cycle at {cid}"
        gen[cid] = 0 if not deps[cid] else 1 + max(of(d, stack + (cid,)) for d in deps[cid])
        return gen[cid]

    for cid in cards:
        of(cid)
    return gen


def full_args(exclude=()):
    return " ".join(["--passWithNoTests"] + [f"--exclude {x}" for x in exclude])


def names_kept(test, drop=()):
    """A patched test file keeps every test name it had at HEAD (docs/TASK_P9b_runloop.md §3), except the
    names its spec replaces (docs/TASK_P9c_retry.md §3)."""
    skip = "".join(" | grep -vxF " + json.dumps('"' + d + '"') for d in drop)
    return ("echo '== names " + test + "'; git show HEAD:" + test + " | grep -oE '(test|it)\\(\"[^\"]+\"' | sed -E 's/^(test|it)\\(//'"
            + skip + " > $P/names || true; "
            "while IFS= read -r n; do grep -qF \"$n\" " + test + " || { echo \"test removed: $n\"; exit 1; }; done < $P/names\n")


def code_acceptance(card, targets, siblings, parts, phase="p1", test_dir=P1_TEST_DIR, smoke_test=True,
                    own_git=False, extra="", exclude=()):
    """A code card: probe-dir, tsc, eslint, guard, probe, [own smoke test], full suite, frozen.
    ``smoke_test=False`` (P3 on: a code card covered by a probe writes no test file) drops the
    own-test guard and step and asserts the card targets no test file."""
    code = [t for t in targets if t.startswith("src/")]
    smoke = [t for t in targets if t.startswith(test_dir)]
    if smoke_test:
        assert len(smoke) == 1, (card, targets)
        guard_tests = f"; node $P/guard.mjs tests {smoke[0]} 1 {P1_SMOKE_MAX}"
        own = "echo '== own'; " + vt(smoke[0])
    else:
        assert not smoke and code == list(targets), (card, targets)
        guard_tests, own = "", ""
    body = (probe_dir(card, parts, f"{card}.probe.ts", exclude=siblings)
            + (own_git_before() if own_git else "")
            + tsc_probe()
            + eslint(" ".join(targets))
            + "echo '== guard'; node $P/guard.mjs src " + ",".join(code)
            + guard_tests + "\n"
            + "echo '== probe'; " + vt("--config $P/probe.config.mts")
            + own
            + eslint_verdict()
            + extra
            + "echo '== full'; " + vt(full_args(exclude))
            + (own_git_after() if own_git else "")
            + "echo '== frozen'; " + frozen()
            + untracked(targets))
    return wrap(card, phase, targets, body)


def judge_acceptance(card, targets, siblings, parts, phase="p1", examples=P1_JUDGE_EXAMPLES,
                     literals=P1_JUDGE_LITERALS, own_git=False, own_cap=12, exclude=(), keep_names=False):
    assert len(targets) == 1, (card, targets)
    test = targets[0]
    n = examples[card]
    lits = json.dumps(literals[card])
    body = (probe_dir(card, parts, None, exclude=siblings)
            + (own_git_before() if own_git else "")
            + tsc_probe()
            + eslint(test)
            + heredoc("$P/lits.json", lits, "MORPH_LITS_EOF")
            + f"echo '== guard'; node $P/guard.mjs tests {test} {n} {n + own_cap} $P/lits.json\n"
            + (names_kept(test) if keep_names else "")
            + "echo '== own'; " + vt(test)
            + eslint_verdict()
            + "echo '== full'; " + vt(full_args(exclude))
            + (own_git_after() if own_git else "")
            + "echo '== frozen'; " + frozen()
            + untracked(targets))
    return wrap(card, phase, targets, body)


def judge_files_acceptance(card, files, siblings, phase, exclude=()):
    """A judge that patches one or more test files (P9c): per file its guard bounds, literals and kept
    names; then its own files together, the full suite, frozen, untracked."""
    targets = [f["file"] for f in files]
    body = probe_dir(card, None, None, exclude=siblings) + tsc_probe()
    body += eslint(" ".join(targets))
    for n, f in enumerate(files):
        body += heredoc(f"$P/lits{n}.json", json.dumps(f["lits"]), "MORPH_LITS_EOF")
        body += f"echo '== guard {f['file']}'; node $P/guard.mjs tests {f['file']} {f['min']} {f['max']} $P/lits{n}.json\n"
    for f in files:
        if not f.get("new"):  # a file the judge creates has no names at HEAD (P10a)
            body += names_kept(f["file"], f["drop"])
    body += ("echo '== own'; " + vt(" ".join(targets))
             + eslint_verdict()
             + "echo '== full'; " + vt(full_args(exclude))
             + "echo '== frozen'; " + frozen()
             + untracked(targets))
    return wrap(card, phase, targets, body)


def build_phase(phase):
    """Inject the acceptance of every card of ``phase`` (its judges and their code cards)
    into morph-map.json; the other phases' cards are left byte for byte."""
    spec = PHASES[phase]
    LOCATE["on"] = spec.get("locate", False)
    FULL["on"] = spec.get("full_report", False)
    parts = os.path.join(ROOT, "decks", spec["parts"], "parts")
    with open(MAP, encoding="utf-8") as fh:
        doc = json.load(fh)
    judges = list(spec["examples"])
    members = spec.get("members") or [j[:-6] for j in judges] + judges
    cards = {cid: c for cid, c in doc["cards"].items() if cid in members}
    missing = [m for m in members if m not in cards]
    assert not missing, f"{phase}: cards missing from {MAP}: {missing}"
    gen = layer(cards)
    rows = []
    for cid, c in cards.items():
        targets = list(c["targets"])
        siblings = [t for other, o in cards.items() if other != cid and gen[other] == gen[cid]
                    for t in o["targets"]]
        exclude = spec.get("full_exclude", ())
        if cid in spec.get("judge_files", {}):
            files = spec["judge_files"][cid]
            assert [f["file"] for f in files] == targets, (cid, targets)
            c["acceptance"] = judge_files_acceptance(cid, files, siblings, phase, exclude)
        elif cid.endswith("-judge"):
            c["acceptance"] = judge_acceptance(cid, targets, siblings, parts, phase,
                                               spec["examples"], spec["literals"], spec.get("own_git", False),
                                               spec.get("own", {}).get(cid, 12), exclude,
                                               cid in spec.get("keep_names", ()))
        else:
            smoke_dir = spec.get("smoke_dirs", {}).get(cid)
            c["acceptance"] = code_acceptance(cid, targets, siblings, parts, phase, smoke_dir or spec["test_dir"],
                                              spec["smoke"] or smoke_dir is not None, spec.get("own_git", False),
                                              spec.get("extra", {}).get(cid, ""), exclude)
        rows.append((gen[cid], cid, len(c["acceptance"]), len(siblings)))
    with open(MAP, "w", encoding="utf-8") as fh:
        json.dump(doc, fh, indent=2, ensure_ascii=False)
        fh.write("\n")
    for g, cid, n, k in sorted(rows):
        print(f"gen {g}  {cid:18} acceptance {n:6} chars, {k} sibling targets excluded from tsc")
    print(f"wrote {MAP}: {len(rows)} cards")


BUILDERS = {"p0": build_p0, "p1": lambda: build_phase("p1"), "p2": lambda: build_phase("p2"),
            "p3": lambda: build_phase("p3"), "p4": lambda: build_phase("p4"), "p5": lambda: build_phase("p5"),
            "p6": lambda: build_phase("p6"), "p7": lambda: build_phase("p7"),
            "p8": lambda: build_phase("p8"), "p9": lambda: build_phase("p9"), "p9b": lambda: build_phase("p9b"),
            "p9c": lambda: build_phase("p9c"), "p10": lambda: build_phase("p10"), "p10b": lambda: build_phase("p10b"),
            "p10b2": lambda: build_phase("p10b2")}


def main(argv):
    if len(argv) != 2 or argv[1] not in BUILDERS:
        print(f"usage: build.py <{'|'.join(BUILDERS)}>", file=sys.stderr)
        return 2
    os.chdir(ROOT)
    BUILDERS[argv[1]]()
    return 0


if __name__ == "__main__":
    sys.exit(main(sys.argv))

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

Paths are relative to the repository root (the parent of decks/); nothing here points
outside the tree.
"""
import json
import os
import sys

HERE = os.path.dirname(os.path.abspath(__file__))
ROOT = os.path.abspath(os.path.join(HERE, "..", ".."))
GUARD = os.path.join(HERE, "guard.mjs")
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
    if probe_file:
        s += heredoc(f"$P/{card}.probe.ts", read(os.path.join(parts, probe_file)), "MORPH_PROBE_EOF")
    return s


def vt(args):
    return (f"node_modules/.bin/vitest run {args} --reporter=dot > $P/vt.log 2>&1 || "
            "{ grep -E '^ FAIL |Error|AssertionError|^ +Tests |^ +Test Files |expected|received' $P/vt.log | head -80; exit 1; }\n")


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


def code_acceptance(card, targets, siblings, parts, phase="p1", test_dir=P1_TEST_DIR, smoke_test=True,
                    own_git=False):
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
            + "echo '== eslint'; node_modules/.bin/eslint " + " ".join(targets) + "\n"
            + "echo '== guard'; node $P/guard.mjs src " + ",".join(code)
            + guard_tests + "\n"
            + "echo '== probe'; " + vt("--config $P/probe.config.mts")
            + own
            + "echo '== full'; " + vt("--passWithNoTests")
            + (own_git_after() if own_git else "")
            + "echo '== frozen'; " + frozen()
            + untracked(targets))
    return wrap(card, phase, targets, body)


def judge_acceptance(card, targets, siblings, parts, phase="p1", examples=P1_JUDGE_EXAMPLES,
                     literals=P1_JUDGE_LITERALS, own_git=False):
    assert len(targets) == 1, (card, targets)
    test = targets[0]
    n = examples[card]
    lits = json.dumps(literals[card])
    body = (probe_dir(card, parts, None, exclude=siblings)
            + (own_git_before() if own_git else "")
            + tsc_probe()
            + "echo '== eslint'; node_modules/.bin/eslint " + test + "\n"
            + heredoc("$P/lits.json", lits, "MORPH_LITS_EOF")
            + f"echo '== guard'; node $P/guard.mjs tests {test} {n} {n + 12} $P/lits.json\n"
            + "echo '== own'; " + vt(test)
            + "echo '== full'; " + vt("--passWithNoTests")
            + (own_git_after() if own_git else "")
            + "echo '== frozen'; " + frozen()
            + untracked(targets))
    return wrap(card, phase, targets, body)


def build_phase(phase):
    """Inject the acceptance of every card of ``phase`` (its judges and their code cards)
    into morph-map.json; the other phases' cards are left byte for byte."""
    spec = PHASES[phase]
    parts = os.path.join(ROOT, "decks", spec["parts"], "parts")
    with open(MAP, encoding="utf-8") as fh:
        doc = json.load(fh)
    judges = list(spec["examples"])
    members = [j[:-6] for j in judges] + judges
    cards = {cid: c for cid, c in doc["cards"].items() if cid in members}
    missing = [m for m in members if m not in cards]
    assert not missing, f"{phase}: cards missing from {MAP}: {missing}"
    gen = layer(cards)
    rows = []
    for cid, c in cards.items():
        targets = list(c["targets"])
        siblings = [t for other, o in cards.items() if other != cid and gen[other] == gen[cid]
                    for t in o["targets"]]
        if cid.endswith("-judge"):
            c["acceptance"] = judge_acceptance(cid, targets, siblings, parts, phase,
                                               spec["examples"], spec["literals"], spec.get("own_git", False))
        else:
            c["acceptance"] = code_acceptance(cid, targets, siblings, parts, phase, spec["test_dir"],
                                              spec["smoke"], spec.get("own_git", False))
        rows.append((gen[cid], cid, len(c["acceptance"]), len(siblings)))
    with open(MAP, "w", encoding="utf-8") as fh:
        json.dump(doc, fh, indent=2, ensure_ascii=False)
        fh.write("\n")
    for g, cid, n, k in sorted(rows):
        print(f"gen {g}  {cid:18} acceptance {n:6} chars, {k} sibling targets excluded from tsc")
    print(f"wrote {MAP}: {len(rows)} cards")


BUILDERS = {"p0": build_p0, "p1": lambda: build_phase("p1"), "p2": lambda: build_phase("p2"),
            "p3": lambda: build_phase("p3"), "p4": lambda: build_phase("p4"), "p5": lambda: build_phase("p5"),
            "p6": lambda: build_phase("p6")}


def main(argv):
    if len(argv) != 2 or argv[1] not in BUILDERS:
        print(f"usage: build.py <{'|'.join(BUILDERS)}>", file=sys.stderr)
        return 2
    os.chdir(ROOT)
    BUILDERS[argv[1]]()
    return 0


if __name__ == "__main__":
    sys.exit(main(sys.argv))

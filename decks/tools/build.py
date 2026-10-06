#!/usr/bin/env python3
"""The one acceptance builder of MorphV2: every acceptance of every deck is built from the
shared steps here. Hand-written data, never product code.

    python3 decks/tools/build.py p0     -> decks/p0-scaffold.json (one card, run alone)

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


def probe_dir(card, parts, probe_file=None):
    """probe/<card>/ with the guard, a vitest config and a tsconfig that type-checks the probe
    together with the project; removed on exit."""
    conf = (
        'import { defineConfig } from "vitest/config";\n'
        'import { fileURLToPath } from "node:url";\n'
        'export default defineConfig({\n'
        '  root: fileURLToPath(new URL("../..", import.meta.url)),\n'
        f'  test: {{ environment: "node", include: ["probe/{card}/**/*.probe.ts"],\n'
        '    setupFiles: ["tests/setup.ts"], chaiConfig: { truncateThreshold: 200 } },\n'
        '});\n')
    tsconf = json.dumps({"extends": "../../tsconfig.json",
                         "include": ["../../src", "../../tests", "./*.probe.ts"]}, indent=2) + "\n"
    s = (f"P=$PWD/probe/{card}; rm -rf $P; mkdir -p $P; trap 'rm -rf $P' EXIT\n"
         + heredoc("$P/guard.mjs", read(GUARD), "MORPH_GUARD_EOF")
         + heredoc("$P/probe.config.mts", conf, "MORPH_CONF_EOF")
         + heredoc("$P/tsconfig.probe.json", tsconf, "MORPH_TSCONF_EOF"))
    if probe_file:
        s += heredoc(f"$P/{card}.probe.ts", read(os.path.join(parts, probe_file)), "MORPH_PROBE_EOF")
    return s


def vt(args):
    return (f"node_modules/.bin/vitest run {args} --reporter=dot > $P/vt.log 2>&1 || "
            "{ grep -E '^ FAIL |Error|AssertionError|^ +Tests |^ +Test Files |expected|received' $P/vt.log | head -80; exit 1; }\n")


def tsc_probe():
    return "echo '== tsc'; node_modules/.bin/tsc --noEmit -p $P/tsconfig.probe.json\n"


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


BUILDERS = {"p0": build_p0}


def main(argv):
    if len(argv) != 2 or argv[1] not in BUILDERS:
        print(f"usage: build.py <{'|'.join(BUILDERS)}>", file=sys.stderr)
        return 2
    os.chdir(ROOT)
    BUILDERS[argv[1]]()
    return 0


if __name__ == "__main__":
    sys.exit(main(sys.argv))
